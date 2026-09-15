# Route Check

The public single-segment routes are handled by `app/[section]/page.tsx`.

Target routes:
- `/gold`
- `/silver`
- `/markets`
- `/stocks`
- `/news`
- `/demo`
- `/login`
- `/signup`

Unknown single-segment paths return a controlled 404 page.

The next deployment must be tested against these routes before production sign-off.