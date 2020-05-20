class ABAPI {
  partner
  signature
  exipires

  constructor(partner, signature, expires){
    this.partner = partner
    this.signature = signature
    this.exipires = expires
  }

  // TODO: Refresh authentication when it expires & we have a key
  authenticate(url){
    let original = new URL(url)
    let query = new URLSearchParams(original.search)

    query.set('partner.id', this.partner)
    query.set('auth.signature', this.signature)
    query.set('auth.expires', this.exipires)

    original.search = '?' + query.toString()
    
    return original
  }

  // wrap this.get() into a generator you can page through at your liesure
  // Loosely based on https://dev.to/exacs/es2018-real-life-simple-usage-of-async-iteration-get-paginated-data-from-rest-apis-3i2e
  async * pager(url, config = {}){

    // Run until we consume the generator (usually next()'ing past the end)
    while(url){

      // Get the next (or prev, self, last, etc.) page of data requested
      // by the consumer
      try{
        var body = await this.get(url, config)
      }
      catch(error){
        console.log(error)
      }

      // Return the response. Ask where to page next.
      // There's a lot here. Basically,
      //   return body to the consumer who called next()
      //   user does whatever it is that users do
      //   user calls next('some_string')
      //     ('some_string' is stored in the const next)
      //   program resumes execution on this line
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
    url = this.authenticate(url)

    const response = await fetch(url, config)

    // We can handle API throttling here. Everything else should get
    // propagated (such as API auth errors or invalid parameters)
    if(response.message == 429){

      // Retry up to 100 times, with backoff
      for(const retryCount of Array(100).keys()){
        // This is what causes us to sleep in between requests.
        // Double time each request, for a max of 30 seconds
        await new Promise(r => setTimeout(r, Math.min(
          (retryCount**2) * 500,
          30000
        )));

        // Retry the orginal call
        response = await fetch(url, config)

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
      console.log(body)
      throw new Error(response.status)
    }

    return body
  }
}

module.exports = ABAPI