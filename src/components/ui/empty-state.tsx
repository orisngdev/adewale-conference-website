export default function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border border-dashed border-[rgba(10,15,30,0.2)] p-10 md:p-16 text-center">
      <h3 className="font-bebas text-3xl text-[#0A0F1E]">{title}</h3>
      {children ? (
        <p className="serif-display italic text-[#4A4E5C] mt-3 max-w-md mx-auto leading-relaxed">
          {children}
        </p>
      ) : null}
    </div>
  );
}
