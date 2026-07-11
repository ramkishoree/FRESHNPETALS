export interface AdminResourceField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'datetime' | 'json';
  options?: { label: string; value: string }[];
  required?: boolean;
  placeholder?: string;
}
