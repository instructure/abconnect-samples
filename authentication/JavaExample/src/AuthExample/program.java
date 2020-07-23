package AuthExample;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URL;
import java.net.URLEncoder;
import java.util.Base64;
import java.util.Calendar;
import java.util.TimeZone;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.net.ssl.HttpsURLConnection;

public class program {

	public static void main(String[] args) {
    String partnerID = "public";                   // ID provided by AB.
    String partnerKey = "2jfaWErgt2+o48gsk302kd";  // Key provided by AB.
    String userID = "383485";                      // Partner defined. May be an empty string.
    
    // Seconds since epoch. Example is 24 hours.
    Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("GMT"));
    long expires = (long)Math.floor(cal.getTimeInMillis() / 1000) + 60*60*24;
    
    String message = String.format("%d\n%s", expires, userID); // format message for signature
    
    HttpsURLConnection connection = null;
    try {
      //
      // generate signature and base64 encode it
      //
      Mac sha256_HMAC = Mac.getInstance("HmacSHA256");
      SecretKeySpec secret_key = new SecretKeySpec(partnerKey.getBytes("UTF-8"), "HmacSHA256");
      sha256_HMAC.init(secret_key);
      byte[] hmacBytes = sha256_HMAC.doFinal(message.getBytes("UTF8"));
      String signature = Base64.getEncoder().encodeToString(hmacBytes);
      //
      // pack the signature and other auth parameters in URL
      //
      String targetURL = String.format(
        "https://api.abconnect.certicaconnect.com/rest/v4.1/standards?partner.id=%s&auth.signature=%s&auth.expires=%d&user.id=%s",
        URLEncoder.encode(partnerID, "UTF-8"),
        URLEncoder.encode(signature, "UTF-8"),
        expires,
        URLEncoder.encode(userID, "UTF-8")
        );
      //
      //Create connection
      //
      URL url = new URL(targetURL);
      connection = (HttpsURLConnection) url.openConnection();
      //
      // Get Response
      //
      InputStream is = connection.getInputStream();
      BufferedReader rd = new BufferedReader(new InputStreamReader(is));
      String line;
      while ((line = rd.readLine()) != null) {
        System.out.println(line);
      }
      rd.close();
      
    } catch (Exception e) {
      e.printStackTrace();
      System.exit(-1);
    } finally {
      if (connection != null) {
        connection.disconnect();
      }
    }
	}
}

