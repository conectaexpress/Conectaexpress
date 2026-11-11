import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { getHomeRouteForRole } from "@/lib/rbac";

export default async function HomePage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  redirect(getHomeRouteForRole(session.rolCodigo));
}
