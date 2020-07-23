using System;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
    
class Program
  {
  static void Main(string[] args)
  {
    var partnerID = "public";                   // ID provided by AB.
    var partnerKey = "2jfaWErgt2+o48gsk302kd";  // Key provided by AB.
    var userID = "383485";                      // Partner defined. May be an empty string.

    // Seconds since epoch. Example is 24 hours.
    var expires = (long)Math.Floor(
      (DateTime.UtcNow.AddHours(24) - new DateTime(1970, 1, 1, 0, 0, 0)).TotalSeconds
    );

    var message = string.Format("{0}\n{1}", expires, userID);

    var keyBytes = Encoding.UTF8.GetBytes(partnerKey);
    var messageBytes = Encoding.UTF8.GetBytes(message);

    string signature;
    using (var hmac = new HMACSHA256(keyBytes))
    {
      signature = Convert.ToBase64String(hmac.ComputeHash(messageBytes));
    }

    var requestBuilder = new UriBuilder("https://api.abconnect.certicaconnect.com/rest/v4.1/standards");
    requestBuilder.Query = string.Format(
      "partner.id={0}&auth.signature={1}&auth.expires={2}&user.id={3}",
      WebUtility.UrlEncode(partnerID),
      WebUtility.UrlEncode(signature),
      expires,
      WebUtility.UrlEncode(userID)
    );

    var request = WebRequest.Create(requestBuilder.Uri);
    Console.WriteLine(new StreamReader(request.GetResponse().GetResponseStream()).ReadToEnd());
  }
}