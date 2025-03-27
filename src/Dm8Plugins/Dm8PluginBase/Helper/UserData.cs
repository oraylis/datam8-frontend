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
using System.Buffers.Text;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

namespace Dm8PluginBase.Helper
{
    public class UserData
    {
        private static string extension = ".dm8encode";

        [System.Diagnostics.CodeAnalysis.SuppressMessage("Interoperability", "CA1416:Validate platform compatibility", Justification = "<Pending>")]
        public static void Save(string name, string data)
        {
            string folder = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string file = Path.Combine(folder, $"{name}{extension}");


            data = "0LoremIpsum12312LoremIpsum12334567890ABCDEFGXX|" + data + "|LoremIpsum123LoremIpsum123LoremIpsum123LoremIpsum123LoremIpsum123LoremIpsum123LoremIpsum123LoremIpsum123LoremIpsum123LoremIpsum123";
            data = Base64Encode(data);
            File.WriteAllText(file, data);

            // Falls mal wieder das Wiederherstellungszertificat abgelaufen ist...
            try
            {
                File.Encrypt(file);
            }
            catch { }

        }

        [System.Diagnostics.CodeAnalysis.SuppressMessage("Interoperability", "CA1416:Validate platform compatibility", Justification = "<Pending>")]
        public static string Load(string name)
        {
            string folder = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string file = Path.Combine(folder, $"{name}{extension}");
            string data = "";

            if (!File.Exists(file))
            {
                return ("");
            }


            // Falls mal wieder das Wiederherstellungszertificat abgelaufen ist...
            try
            {
                File.Decrypt(file);
            }
            catch
            {
            }

            data = File.ReadAllText(file);

            // Falls mal wieder das Wiederherstellungszertificat abgelaufen ist...
            try
            {
                File.Encrypt(file);
            }
            catch
            {
            }

            // Falls File leer oder ungültig...
            try
            {
                data = Base64Decode(data);
                string[] lst = data.Split('|');
                data = lst[1];
            }
            catch
            {
            }
            return (data);
        }

        public static void Delete(string name)
        {
            string folder = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string file = Path.Combine(folder, $"{name}{extension}");

            if (File.Exists(file))
            {
                File.Delete(file);
            }
        }
        private static string Base64Encode(string plainText)
        {
            var plainTextBytes = System.Text.Encoding.UTF8.GetBytes(plainText);
            return System.Convert.ToBase64String(plainTextBytes);
        }
        private static string Base64Decode(string base64EncodedData)
        {
            var base64EncodedBytes = System.Convert.FromBase64String(base64EncodedData);
            return System.Text.Encoding.UTF8.GetString(base64EncodedBytes);
        }
    }
}
