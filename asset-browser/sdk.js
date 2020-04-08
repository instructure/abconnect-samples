class ABAPI {
  partner
  signature
  exipires

  authenticationCallback

  constructor(authenticationCallback){
    this.authenticationCallback = authenticationCallback
  }

  authenticate(url){
    let original = new URL(url)
    let query = new URLSearchParams(original.search)

    query.set('partner.id', this.partner)
    query.set('auth.signature', this.signature)
    query.set('auth.expires', this.expires)

    original.search = '?' + query.toString()
    
    return original
  }

  // wrap this.get() into a generator you can page through at your liesure
  // Loosely based on https://dev.to/exacs/es2018-real-life-simple-usage-of-async-iteration-get-paginated-data-from-rest-apis-3i2e
  async * pager(url, config = {}){

    // Run until we consume the generator (usually next()'ing past the end)
    while(url){

      // Attempt the AJAX request. Get the response
      try{
        var body = await this.get(url, config)
      }
      catch(error){
        
      }

      // Return the response. Ask where to page next.
      const next = yield body

      // Set the URL based on where we want to page to. Default is forward.
      // If we page past the end (or beginning) of the list, url will be
      // undefined and the generator will be consumed
      if(next == 'next' || next == undefined){
        url = body.links.next
      }
      else if (next == 'last'){
        url = body.links.last
      }
      else if (next == 'prev'){
        url = body.links.prev
      }
      else if (next == 'first'){
        url = body.links.first
      }
      else {
        url = undefined
      }
    }
  }
  
  async get(url, config = {}){
    // If authentication is missing, get it
    if(!this.partner){
      const auth = await this.authenticationCallback()

      this.partner = auth.partner_id
      this.signature = auth.auth_signature
      this.expires = auth.auth_expires
    }
    url = this.authenticate(url)

    let response = await fetch(url, config)

    // If we had a problem authenticating, try refreshing it
    // (by setting partner to null, which forces get() to recalc)
    if (response.status == 401) {
      this.partner = undefined

      response = await fetch(url, config)
    }

    // We can also handle API throttling here. Everything else should get
    // propagated (such as invalid parameters)
    if(response.status == 429){

      // Retry up to 5 times, with backoff
      for(const retryCount of Array(5).keys()){
        // This is what causes us to sleep in between requests
        await new Promise(r => setTimeout(r, retryCount * 500));

        // Retry the orginal call
        response = await this.get(url, config)

        // Success! Continue as if nothing happened
        if(response.status <= 400){
          break
        }
      }
    }
    // If there's an internal server error, don't try to parse the JSON, just bail
    if(response.status >= 500){
      throw new Error(response.status)
    }

    const body = await response.json()

    // Throw the rest of the errors
    if(response.status >= 400){
     throw new Error(response.status)
    }

    return body
  }
}