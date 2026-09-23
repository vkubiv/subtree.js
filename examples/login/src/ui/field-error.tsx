export function FieldError({ message }: { message: string | null }) {
  if (message === null) return null;
  return <p className="error">{message}</p>;
}
