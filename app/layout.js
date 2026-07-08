import LegacyScripts from "./legacy-scripts";

export const metadata = {
  title: "PEA Chaiburi Standby",
  description: "PEA Chaiburi Standby Web Application",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#6b1fa7",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <meta charSet="utf-8" />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        />
        <link rel="stylesheet" href="/css/styles.css" />
      </head>
      <body>
        {children}
        <LegacyScripts />
      </body>
    </html>
  );
}
