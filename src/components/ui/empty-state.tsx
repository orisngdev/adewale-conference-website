export default function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border border-dashed border-foreground/20 p-10 md:p-16 text-center">
      <h3 className="font-bebas text-3xl text-foreground">{title}</h3>
      {children ? (
        <p className="serif-display italic text-muted-foreground mt-3 max-w-md mx-auto leading-relaxed">
          {children}
        </p>
      ) : null}
    </div>
  );
}
