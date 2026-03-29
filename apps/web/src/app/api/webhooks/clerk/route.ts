import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { connectDB } from '@/lib/db';
import User from '@/models/User';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env');
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: any;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occured', {
      status: 400
    });
  }

  // Handle the webhook
  const { id } = evt.data;
  const eventType = evt.type;

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { email_addresses, first_name, last_name, primary_email_address_id } = evt.data;

    let email = '';
    if (email_addresses && email_addresses.length > 0) {
      const primaryEmailObj = email_addresses.find((e: any) => e.id === primary_email_address_id);
      email = primaryEmailObj ? primaryEmailObj.email_address : email_addresses[0].email_address;
    }

    try {
      await connectDB();
      
      await User.findOneAndUpdate(
        { clerk_id: id },
        {
          $set: {
            email: email,
            name: `${first_name || ''} ${last_name || ''}`.trim(),
            updated_at: new Date()
          },
          $setOnInsert: {
            clerk_id: id,
            subscription_tier: 'free',
            created_at: new Date(),
            wishlist: []
          }
        },
        { upsert: true, new: true }
      );
      
      console.log(`User ${id} synchronized to MongoDB`);
    } catch (e) {
      console.error('Error synchronizing user to MongoDB:', e);
      return new Response('Database error', { status: 500 });
    }
  }

  if (eventType === 'user.deleted') {
    try {
      await connectDB();
      await User.findOneAndDelete({ clerk_id: id });
    } catch (e) {
      console.error('Error deleting user from MongoDB:', e);
    }
  }

  return new Response('', { status: 200 });
}
