using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Data;
using Accessibility;

namespace Dm8Main.Base
{
    public class EmptyToNullConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value == null)
                return null;
            return string.IsNullOrEmpty(value.ToString()) ? null : value;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is String s)
            {
                if (string.IsNullOrEmpty(s))
                {
                    return null;
                }
                else
                {
                    if (int.TryParse(value.ToString(), out int v))
                        return v;
                    else
                        return null;
                }
            }

            return value;
        }
    }
}
