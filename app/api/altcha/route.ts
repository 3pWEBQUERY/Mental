import { connection } from 'next/server'
import { newChallenge } from '@/lib/server/altcha'

export async function GET() {
  await connection()
  return Response.json(await newChallenge(), { headers: { 'Cache-Control': 'no-store' } })
}
