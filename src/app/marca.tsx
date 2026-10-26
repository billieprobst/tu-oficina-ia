import Link from "next/link";

export function Marca({ sub }: { sub: string }) {
  return (
    <Link href="/oficina" className="marca">
      <svg width="30" height="30" viewBox="0 0 26 26" aria-hidden="true">
        <rect width="26" height="26" rx="7" fill="#fe5a00" />
        <rect x="9" y="7" width="8" height="13" rx="1.5" fill="#fff" />
        <circle cx="15" cy="13.5" r="1" fill="#fe5a00" />
      </svg>
      <div>
        <b>
          Tu oficina <span>IA</span>
        </b>
        <small>{sub}</small>
      </div>
    </Link>
  );
}
