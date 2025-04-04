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
    public class ControlAdorner : Adorner
    {
        private Control _child;
        public AdornedPlaceholder Placeholder { get; set; }

        public ControlAdorner(UIElement adornedElement)
            : base(adornedElement)
        {
        }

        protected override int VisualChildrenCount => 1;

        protected override Visual GetVisualChild(int index)
        {
            return index != 0 ? throw new ArgumentOutOfRangeException(nameof(index)) : this._child;
        }

        public Control Child
        {
            get => this._child;
            set
            {
                if (this._child != null)
                {
                    this.RemoveVisualChild(this._child);
                }

                this._child = value;
                if (this._child != null)
                {
                    this.AddVisualChild(this._child);
                }
            }
        }

        protected override Size MeasureOverride(Size constraint)
        {
            this._child.Measure(constraint);
            return this._child.DesiredSize;
        }

        protected override Size ArrangeOverride(Size finalSize)
        {
            this._child.Arrange(new Rect(new Point(0, 0), finalSize));
            this.UpdateLocation();
            return new Size(this._child.ActualWidth, this._child.ActualHeight);
        }

        private void UpdateLocation()
        {
            if (this.Placeholder == null) return;
            Transform t = (Transform)this.TransformToDescendant(this.Placeholder);
            if (t == Transform.Identity) return;
            var oldTransfor = this.RenderTransform;
            if (oldTransfor == null || oldTransfor == Transform.Identity)
            {
                this.RenderTransform = t;
            }
            else
            {
                var g = new TransformGroup();
                g.Children.Add(oldTransfor);
                g.Children.Add(t);
                this.RenderTransform =
                    new MatrixTransform(g.Value);
            }
        }

    }

}
