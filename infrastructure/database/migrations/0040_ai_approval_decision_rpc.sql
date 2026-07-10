-- Ch.9 §11/§49 Approval Queue ("Administrator sees Task/Reason/
-- Confidence/Preview/Diff — Approve/Reject/Edit/Regenerate") + §100's
-- ai_approval_decision enum. Recording a decision and advancing the
-- task's status are two tables (ai_approvals, ai_tasks) that must move
-- together — same atomicity rule as every other multi-table write in
-- this project (see checkout_complete, migration 0037).

create or replace function public.ai_approval_decide(
  p_task_id uuid,
  p_decision ai_approval_decision,
  p_approver uuid,
  p_reason text default null,
  p_edited_output jsonb default null
)
returns public.ai_tasks
language plpgsql
as $$
declare
  v_task public.ai_tasks;
  v_new_status ai_task_status;
begin
  select * into v_task from public.ai_tasks where id = p_task_id for update;
  if not found then
    raise exception 'No AI task %', p_task_id using errcode = 'P0010';
  end if;

  if v_task.status != 'waiting_approval' then
    raise exception 'AI task % is not awaiting approval (status %)', p_task_id, v_task.status
      using errcode = 'P0011';
  end if;

  insert into public.ai_approvals (task_id, approver, decision, reason, metadata)
  values (p_task_id, p_approver, p_decision, p_reason, coalesce(p_edited_output, '{}'::jsonb));

  v_new_status := case p_decision
    when 'approved' then 'completed'
    when 'edited' then 'completed'
    when 'rejected' then 'rejected'
    else 'waiting_approval' -- 'deferred': stays in the queue for later review
  end;

  update public.ai_tasks
  set
    status = v_new_status,
    completed_at = case when v_new_status in ('completed', 'rejected') then now() else completed_at end,
    metadata = case
      when p_decision = 'edited' then metadata || jsonb_build_object('editedOutput', p_edited_output)
      else metadata
    end
  where id = p_task_id
  returning * into v_task;

  insert into public.ai_audit_log (agent_id, task_id, result)
  values (v_task.assigned_agent, v_task.id, jsonb_build_object('decision', p_decision, 'reason', p_reason));

  return v_task;
end;
$$;

comment on function public.ai_approval_decide is
  'Atomically records an approval decision and advances the task status (Ch.9 §11/§49 Approval Queue). Admin API only.';

revoke all on function public.ai_approval_decide from public, anon, authenticated;
grant execute on function public.ai_approval_decide to service_role;
