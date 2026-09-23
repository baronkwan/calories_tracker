// Build stamp — injected by vite (git short hash). Lets us tell instantly which
// bundle a device is actually running when a display bug can't be reproduced.
const v = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
export default v
