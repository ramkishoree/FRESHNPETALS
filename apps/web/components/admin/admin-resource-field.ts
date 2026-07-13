export interface AdminResourceField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'datetime' | 'json' | 'image';
  options?: { label: string; value: string }[];
  required?: boolean;
  placeholder?: string;
  /** Small note shown under the field — e.g. explaining why a select has no options yet. */
  helperText?: string;
}
