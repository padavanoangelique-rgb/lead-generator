/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers(){return [{source:"/:path*",headers:[{key:"Content-Security-Policy",value:"frame-ancestors 'self' https://mpcommonwealth.site https://the-commonwealth-command.padavano-angelique.chatgpt.site https://admin.majesticpermits.com"}]}];}
};

module.exports = nextConfig;
