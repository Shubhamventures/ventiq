import { redirect } from "next/navigation";

export const metadata = {
  title: "VENTIQ",
  description: "VENTIQ private capital operating system.",
};

export default function DatabaseTestPage() {
  redirect("/");
}