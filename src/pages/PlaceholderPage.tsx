interface PlaceholderPageProps {
  title: string;
  description: string;
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-600">
      <div className="max-w-xl space-y-2">
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
        <p className="text-xs text-slate-400">
          Veri modelleri, SQL şeması ve RLS kuralları tamamlandığında bu ekran modüler olarak
          güncellenecektir.
        </p>
      </div>
    </div>
  );
}
