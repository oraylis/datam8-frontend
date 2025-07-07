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
using System.Collections.Specialized;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using MvvmDialogs;

namespace Dm8Main.Base
{
    public static class WindowExt
    {
        public static StringCollection StoreState(this Window This)
        {
            var rc = new StringCollection();
            rc.Add(This.Left.ToString());
            rc.Add(This.Top.ToString());
            rc.Add(This.Width.ToString());
            rc.Add(This.Height.ToString());
            rc.Add(This.WindowState.ToString());
            return rc;
        }

        public static void RestoreState(this Window This, StringCollection state)
        {
            try
            {
                This.Left = double.Parse(state[0]);
                This.Top = double.Parse(state[1]);
                This.Width = double.Parse(state[2]);
                This.Height = double.Parse(state[3]);
                This.WindowState = Enum.Parse<WindowState>(state[4]);
            }
            catch
            {
            }
        }

        public static void EnableRoundedCorners(this Window This)
        {
            try
            {
                if (Environment.OSVersion.Platform == PlatformID.Win32NT)
                {
                    var hwnd = new System.Windows.Interop.WindowInteropHelper(This).Handle;
                    if (hwnd != IntPtr.Zero)
                    {
                        var preference = Dm8Main.Base.WindowExt.DwmWindowCornerPreference.DWMWCP_ROUND;
                        _ = Dm8Main.Base.WindowExt.DwmSetWindowAttribute(
                            hwnd,
                            Dm8Main.Base.WindowExt.DwmWindowAttribute.DWMWA_WINDOW_CORNER_PREFERENCE,
                            ref preference,
                            sizeof(uint));
                    }
                }
            }
            catch
            {
            }
        }

        private enum DwmWindowAttribute
        {
            DWMWA_WINDOW_CORNER_PREFERENCE = 33
        }

        private enum DwmWindowCornerPreference
        {
            DWMWCP_DEFAULT = 0,
            DWMWCP_DONOTROUND = 1,
            DWMWCP_ROUND = 2,
            DWMWCP_ROUNDSMALL = 3
        }

        [System.Runtime.InteropServices.DllImport("dwmapi.dll")]
        private static extern int DwmSetWindowAttribute(
            IntPtr hwnd,
            DwmWindowAttribute attribute,
            ref DwmWindowCornerPreference pvAttribute,
            int cbAttribute);
    }
}
