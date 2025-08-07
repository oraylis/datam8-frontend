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
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Runtime.Versioning;

#pragma warning disable IDE0079 // Remove unnecessary suppression
#pragma warning disable CS8629 // Nullable value type may be null.
#pragma warning disable CS8600 // Nullable value type may be null.
#pragma warning disable CS8601 // Nullable value type may be null.
#pragma warning disable IDE0130 // Namespace does not match folder structure
#pragma warning disable IDE0090
#pragma warning disable IDE0028
#pragma warning disable IDE0060
#pragma warning disable IDE0063
#pragma warning disable IDE1006
#pragma warning disable CA1822 // Mark members as static

namespace Dm8Data.Helper
{
   public static class PngHelper
   {
      [SupportedOSPlatform("windows")]
      public static string Crop(string path ,int width ,int height)
      {
         Rectangle cropRect = new Rectangle(0 ,0 ,width ,height);
         using (Bitmap src = Image.FromFile(path) as Bitmap)
         {
            using (Bitmap target = new Bitmap(cropRect.Width ,cropRect.Height))
            {
               using (Graphics g = Graphics.FromImage(target))
               {
                  g.DrawImage(src ,new Rectangle(0 ,0 ,target.Width ,target.Height) ,
                      cropRect ,
                      GraphicsUnit.Pixel);
               }
               var outFile = Path.GetTempFileName().Replace(".tmp" ,".png");
               target.Save(outFile ,ImageFormat.Png);
               return outFile;
            }
         }
      }


      /// <summary>
      /// Gets the dimensions of an image.
      /// </summary>
      /// <param name="path">The path of the image to get the dimensions of.</param>
      /// <returns>The dimensions of the specified image.</returns>
      /// <exception cref="ArgumentException">The image was of an unrecognized format.</exception>
      public static Size GetDimensions(string path)
      {
         using (BinaryReader binaryReader = new BinaryReader(File.OpenRead(path)))
         {
            try
            {
               return DecodePng(binaryReader);
            } catch (ArgumentException e)
            {
               if (e.Message.StartsWith("Could not recognize image format."))
               {
                  throw new ArgumentException("Could not recognize image format." ,path ,e);
               } else
               {
                  throw;
               }
            }
         }
      }

      // Other decoding methods for different image formats (e.g., GIF, JPEG) go here...

      private static Size DecodePng(BinaryReader reader)
      {
         // Extract dimensions from PNG header
         reader.BaseStream.Position = 16;
         byte[] widthBytes = reader.ReadBytes(4);
         byte[] heightBytes = reader.ReadBytes(4);
         int width = BitConverter.ToInt32(widthBytes.Reverse().ToArray() ,0);
         int height = BitConverter.ToInt32(heightBytes.Reverse().ToArray() ,0);
         return new Size(width ,height);
      }

      // Other decoding methods for different image formats (e.g., GIF, JPEG) go here...
   }
}


