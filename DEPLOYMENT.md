# Deployment Guide for Delivery Bid System

## Deploying to Vercel

1. **Create a Vercel Account**: If you don’t have an account, sign up at [Vercel](https://vercel.com).

2. **Import Project**: After logging in, click on ‘New Project’ and import your GitHub repository (`twasalni7/Delivery-Bid-System`).

3. **Environment Variables**: 
   - Navigate to the settings of your project. 
   - Under the ‘Environment Variables’ section, add the following:
     - `SUPABASE_URL`: Your Supabase project URL.
     - `SUPABASE_ANON_KEY`: Your Supabase anon key.

4. **Configure Build Settings**: Ensure that your build command and output directory are set correctly. The default settings typically work.

5. **Deploy**: Click on ‘Deploy’ to start the deployment process. Vercel will automatically build and deploy your project.

## Deploying to Render

1. **Create a Render Account**: Sign up at [Render](https://render.com) if you don’t have an account.

2. **Create a New Web Service**: Click on ‘New’ and select ‘Web Service’. 

3. **Connect GitHub Repository**: Connect your GitHub account and select the `twasalni7/Delivery-Bid-System` repository.

4. **Environment Variables**:
   - In the settings of your service, set the same environment variables as for Vercel:
     - `SUPABASE_URL`: Your Supabase project URL.
     - `SUPABASE_ANON_KEY`: Your Supabase anon key.

5. **Build Command & Start Command**: Set the build command and the start command as needed (commonly `npm run build` and `npm start`).

6. **Deploy**: Click on ‘Create Web Service’ to initiate the deployment. Render will build and deploy your application.

## Connect to Supabase Database

To connect your application to Supabase, make sure that the connection string follows the format:

```
SUPABASE_URL=<your_supabase_url>
SUPABASE_ANON_KEY=<your_supabase_anon_key>
```

Ensure that you replace `<your_supabase_url>` and `<your_supabase_anon_key>` with the actual values from your Supabase project settings.

---

## Additional Notes

- Ensure that your project works locally before deploying.
- Monitor the Vercel and Render dashboards for any build errors or logs to troubleshoot deployment issues.