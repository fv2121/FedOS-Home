export const metadata = {
  title: "Product Architecture — FedOS Admin",
};

export default function ArchitecturePage() {
  return (
    <div className="h-full">
      <iframe
        src="/fedos-home-architecture-map.html"
        className="w-full h-full border-0 block"
        title="Product Architecture"
      />
    </div>
  );
}
