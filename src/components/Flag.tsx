import { ISO } from "@/lib/plan";

export function Flag({ country }: { country: string }) {
  const code = ISO[country];
  if (!code) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="flag" src={`https://flagcdn.com/w40/${code}.png`} width={20} height={14} alt="" loading="lazy" />;
}
