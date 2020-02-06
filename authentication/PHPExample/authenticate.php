<!DOCTYPE html>
<HTML>
<HEAD>
</HEAD>
<BODY>
  <?php
    $partnerID   = 'public';                  // ID provided by AB.
    $partnerKey  = '2jfaWErgt2+o48gsk302kd';  // Key provided by AB.
    $authExpires = time() + 3600;             // Seconds since epoch. Example is 1 hour.  Keep this shorter due to web exposure.
    $userID      = 'bob';                     // Partner defined. May be an empty string.

    $url = 'https://api.academicbenchmarks.com/rest/v4.1/standards?';

    $url .= 'partner.id=' . $partnerID;
    $message = $authExpires . "\n" . $userID . "\nGET"; // read only signature to minimize security risks with web client exposure.
    $sig = urlencode(base64_encode(hash_hmac('sha256', $message, $partnerKey, true))); // build the signature with the key

    $url .= '&auth.signature=' . $sig;
    $url .= '&auth.expires=' . $authExpires;
    if ($url) {
      $url .= '&user.id=' . $userID;
    }

    print '<H3>Generated Request URL</H3>';
    print '<P>' . $url . '</P><BR />';

    $response = file_get_contents($url);

    print '<H3>JSON Response</H3>';
    print '<P>' . $response . '</P>';
  ?>
</BODY>
</HTML>