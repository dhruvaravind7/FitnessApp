const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Auth form rules. `tab` is 'login' | 'register'. */
export function validateAuth(tab, { username, password, email }) {
  const errors = {}
  if (!username.trim()) errors.username = 'Username is required'
  else if (tab === 'register' && username.trim().length < 3) errors.username = 'At least 3 characters'
  if (!password) errors.password = 'Password is required'
  else if (tab === 'register' && password.length < 8) errors.password = 'At least 8 characters'
  if (tab === 'register') {
    if (!email.trim()) errors.email = 'Email is required'
    else if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid email'
  }
  return errors
}

/** Exercise log form rules (values are strings from inputs). */
export function validateLog({ sets, reps, weight }) {
  const errors = {}
  if (!sets || Number(sets) < 1) errors.sets = 'Enter at least 1 set'
  if (!reps || Number(reps) < 1) errors.reps = 'Enter at least 1 rep'
  if (weight !== '' && (Number.isNaN(Number(weight)) || Number(weight) < 0)) errors.weight = 'Weight must be 0 or more'
  return errors
}
