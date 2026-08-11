const jwt = "eyJh.eyJzdWIiOiIxMjM".split(".");
if (jwt[1]) {
    let base64 = jwt[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) base64 += '='.repeat(4 - pad);
    console.log(atob(base64));
}
