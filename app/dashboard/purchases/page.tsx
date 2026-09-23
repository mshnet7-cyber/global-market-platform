import { redirect } from "next/navigation";

export default function ModulePage() {
  redirect("/dashboard/operations?tab=purchases");
}
