export function SchoolDocumentHeader({
  title,
  documentNumber,
}: {
  title: string;
  documentNumber: string;
}) {
  return (
    <header className="school-document-header">
      <div className="school-document-brand">
        <div className="school-document-logo" role="img" aria-label="School logo placeholder">
          LOGO
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-950">School Finance</h2>
          <p className="mt-0.5 text-xs text-slate-500">School fee management</p>
        </div>
      </div>
      <div className="school-document-title">
        <p>{title}</p>
        <strong>{documentNumber}</strong>
      </div>
    </header>
  );
}
