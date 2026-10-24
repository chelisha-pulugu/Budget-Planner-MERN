export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.message || `Request failed (${response.status})`)
    error.status = response.status
    throw error
  }
  return data
}

export function currentPeriod() {
  return new Date().toISOString().slice(0, 7)
}

export function formatMoney(value, currency = 'INR') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)
}

export function displayError(error) {
  return error?.message || 'Something went wrong. Please try again.'
}
