Imports System.Security.Cryptography
Imports System.Text
Imports System.Net
Imports System.IO

Module AuthModule

    Sub Main()
        Dim PartnerId As String = "public"                  ' ID provided by AB.
        Dim PartnerKey As String = "2jfaWErgt2+o48gsk302kd" ' Key provided by AB.
        Dim UserId As String = "383485"                     ' Partner defined. May be an empty string.

        ' Seconds since epoch. Example is 24 hours.
        Dim Expires = Math.Floor(
          (DateTime.UtcNow.AddHours(24) - New DateTime(1970, 1, 1, 0, 0, 0)).TotalSeconds
        )
        Dim Message = Expires & vbLf & UserId

        Dim KeyBytes() As Byte = Encoding.UTF8.GetBytes(PartnerKey)
        Dim MessageBytes() As Byte = Encoding.UTF8.GetBytes(Message)
        Dim Signature As String

        Using myHMACSHA256 As New HMACSHA256(KeyBytes)
            Signature = Convert.ToBase64String(myHMACSHA256.ComputeHash(MessageBytes))
        End Using

        Dim RequestBuilder As New UriBuilder("https://api.academicbenchmarks.com/rest/v4/standards")
        RequestBuilder.Query = String.Format(
          "partner.id={0}&auth.signature={1}&auth.expires={2}&user.id={3}",
          WebUtility.UrlEncode(PartnerId),
          WebUtility.UrlEncode(Signature),
          Expires,
          WebUtility.UrlEncode(UserId)
        )

        Dim Request = WebRequest.Create(RequestBuilder.Uri)
        Dim Response As WebResponse = Request.GetResponse()
        Dim ReceiveStream As Stream = Response.GetResponseStream()

        Dim Encode As Encoding = Encoding.GetEncoding("utf-8")

        Dim ReadStream As New StreamReader(ReceiveStream, Encode)
        Dim ReadBuffer(256) As [Char]

        Dim Count As Integer = ReadStream.Read(ReadBuffer, 0, 256)
        While Count > 0
            Dim StringData As New [String](ReadBuffer, 0, Count)
            Console.Write(StringData)
            Count = ReadStream.Read(ReadBuffer, 0, 256)
        End While
        Console.WriteLine("")
    End Sub

End Module