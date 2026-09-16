export async function handleCalendar(req: Request): Promise<Response> {
  // Logic for handling Google Calendar webhooks or actions
  return new Response("Calendar module active", { status: 200 });
}
