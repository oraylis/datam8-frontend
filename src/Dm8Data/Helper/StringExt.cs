/* DataM8
 * Copyright (C) 2024-2025 ORAYLIS GmbH
 *
 * This file is part of DataM8.
 *
 * DataM8 is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * DataM8 is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

using System;
using System.Collections.Generic;
using System.Text;

namespace Dm8Data.Helper
{
   public static class StringExt
   {
      public static string ToName(this string str)
      {
         StringBuilder sb = new StringBuilder();
         foreach (var c in str)
         {
            if (((c >= 'A' && c <= 'Z') || c >= 'a' && c <= 'z' || c >= '0' && c <= '9'))
               sb.Append(c);
            else
               sb.Append('_');
         }
         return sb.ToString();
      }
      public static string ToNameSql(this string str)
      {
         StringBuilder sb = new StringBuilder();
         foreach (var c in str)
         {
            if (((c >= 'A' && c <= 'Z') || c >= 'a' && c <= 'z' || c >= '0' && c <= '9') || c == '$')
               sb.Append(c);
            else
               sb.Append('_');
         }
         return sb.ToString();
      }

      public static Int64 GetInt64HashCode(this string strText)
      {
         Int64 hashCode = 0;
         if (!string.IsNullOrEmpty(strText))
         {
            //Unicode Encode Covering all character set
            byte[] byteContents = Encoding.Unicode.GetBytes(strText);
            System.Security.Cryptography.SHA256 hash = System.Security.Cryptography.SHA256.Create();
            byte[] hashText = hash.ComputeHash(byteContents);

            //32Byte hashText separate
            //hashCodeStart = 0~7  8Byte
            //hashCodeMedium = 8~23  8Byte
            //hashCodeEnd = 24~31  8Byte
            //and Fold
            Int64 hashCodeStart = BitConverter.ToInt64(hashText ,0);
            Int64 hashCodeMedium = BitConverter.ToInt64(hashText ,8);
            Int64 hashCodeEnd = BitConverter.ToInt64(hashText ,24);
            hashCode = hashCodeStart ^ hashCodeMedium ^ hashCodeEnd;
         }
         return (hashCode);
      }

      public static string Right(this string sValue ,int iMaxLength)
      {
         //Check if the value is valid
         if (string.IsNullOrEmpty(sValue))
         {
            //Set valid empty string as string could be null
            sValue = string.Empty;
         } else if (sValue.Length > iMaxLength)
         {
            //Make the string no longer than the max length
            sValue = sValue.Substring(sValue.Length - iMaxLength ,iMaxLength);
         }

         //Return the string
         return sValue;
      }

      /// <summary>
      /// Splits the string by specified separator (string version of split).
      /// </summary>
      /// <param name="input">The input.</param>
      /// <param name="separator">The separator.</param>
      /// <returns></returns>
      public static IEnumerable<string> Split(this string input ,string separator)
      {
         int startOfSegment = 0;
         int index = 0;
         while (index < input.Length)
         {
            index = input.IndexOf(separator ,index);
            if (index == -1)
            {
               break;
            }
            yield return input[startOfSegment..index];
            index += separator.Length;
            startOfSegment = index;
         }
         yield return input[startOfSegment..];
      }
   }


   public static class StringEnumExt
   {

      public static string ToCommaList(this IEnumerable<string> list)
      {
         return list.ToSeparatorList();
      }

      public static string ToSeparatorList(this IEnumerable<string> list ,string sep = "," ,string quote = "")
      {
         var sb = new StringBuilder();
         foreach (var s in list)
         {
            if (sb.Length != 0)
               sb.Append(sep);
            sb.Append(quote);
            sb.Append(s);
            sb.Append(quote);
         }
         return sb.ToString();
      }
   }

}
