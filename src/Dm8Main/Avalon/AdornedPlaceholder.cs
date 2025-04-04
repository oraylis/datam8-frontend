using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;

namespace Dm8Main.Avalon
{
    public class AdornedPlaceholder : FrameworkElement
    {
        public Adorner Adorner
        {
            get
            {
                Visual current = this;
                while (current != null && !(current is Adorner))
                {
                    current = (Visual)VisualTreeHelper.GetParent(current);
                }

                return (Adorner)current;
            }
        }

        public FrameworkElement AdornedElement => this.Adorner == null ? null : this.Adorner.AdornedElement as FrameworkElement;

        protected override Size MeasureOverride(Size availableSize)
        {
            if (this.Adorner is ControlAdorner controlAdorner)
            {
                controlAdorner.Placeholder = this;
            }

            FrameworkElement e = this.AdornedElement;
            return new Size(e.ActualWidth, e.ActualHeight);
        }
    }

}
