import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { metadataBase: new URL("https://truco-da-casa.vercel.app"), title: "Truco da casa", description: "Sua mesa de truco mineiro. Convide os amigos e jogue 1 contra 1 ou em duplas." };
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="pt-BR"><body>{children}</body></html>; }
