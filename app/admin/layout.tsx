import AdminGuard from "@/components/AdminGuard";
import AdminSidebar from "@/components/AdminSidebar";

export const metadata = {
  title: "Admin · Apex Tutor",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <div className="min-h-screen flex bg-slate-50">
        <AdminSidebar />
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </AdminGuard>
  );
}
