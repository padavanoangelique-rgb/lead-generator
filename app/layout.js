import './globals.css';
import NavBar from './NavBar';

export const metadata = {
  title: 'The Permit Closer',
  description: 'Expired permit letter program, leads, sales, and finances for The Permit Closer'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" defer></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js" defer></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" defer></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js" defer></script>
      </head>
      <body>
        <NavBar />
        {children}
      </body>
    </html>
  );
}
