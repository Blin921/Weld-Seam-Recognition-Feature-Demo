import { notFound } from "next/navigation";
export function generateStaticParams() {
  return [
    "scan",
    "recognize",
    "calibration",
    "seams",
    "program",
    "transfer",
  ].map((workflow) => ({ workflow }));
}
export default async function WorkflowPage({
  params,
}: {
  params: Promise<{ workflow: string }>;
}) {
  const { workflow } = await params;
  if (
    ![
      "scan",
      "recognize",
      "calibration",
      "seams",
      "program",
      "transfer",
    ].includes(workflow)
  )
    notFound();
  return null;
}
