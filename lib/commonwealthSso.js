import {createClient as createAdminClient} from "@supabase/supabase-js";
export async function commonwealthOtp(code) {
  const secret=process.env.COMMONWEALTH_SSO_SECRET,userId=process.env.COMMONWEALTH_OWNER_USER_ID;
  if(!secret||!userId||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error("Single sign-in is not configured.");
  if(!/^[a-f0-9]{64}$/.test(code))throw new Error("Invalid sign-in code.");
  const redeemed=await fetch("https://mpcommonwealth.site/api/business/sso/redeem",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+secret},body:JSON.stringify({business:"closer",code}),cache:"no-store"});
  if(!redeemed.ok)throw new Error("Commonwealth login expired. Open the dashboard again.");
  const admin=createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:userData,error:userError}=await admin.auth.admin.getUserById(userId);
  const user=userData.user;
  if(userError||!user||!user.email||!user.email_confirmed_at)throw new Error("Existing verified owner account is required.");
  if(user.factors?.some(f=>f.status==="verified"))throw new Error("This account requires MFA. Use the original sign-in.");
  const emails=(process.env.ADMIN_EMAILS||"angelique@majesticpermits.com").split(",").map(e=>e.trim().toLowerCase());if(!emails.includes(user.email.toLowerCase()))throw new Error("Existing staff permissions required.");
  const {data,error}=await admin.auth.admin.generateLink({type:"magiclink",email:user.email});
  if(error||data.user?.id!==userId||!data.properties?.hashed_token)throw new Error("Owner sign-in could not be generated.");
  return {token_hash:data.properties.hashed_token,userId};
}
