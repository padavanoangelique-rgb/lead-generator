import {commonwealthOtp} from '../../../../lib/commonwealthSso';
export const dynamic='force-dynamic';
export async function POST(req){if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Invalid origin'},{status:403});try{const {code}=await req.json();const otp=await commonwealthOtp(code);return Response.json({token_hash:otp.token_hash,userId:otp.userId},{headers:{'Cache-Control':'no-store'}});}catch(e){return Response.json({error:e.message||'Sign-in failed'},{status:401,headers:{'Cache-Control':'no-store'}});}}
