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

using System.Windows;
using System.Windows.Controls;
using System.Windows.Media.Animation;
using MahApps.Metro.Controls;

namespace Dm8Main.Views.Navigation
{
    public class FrameAnimator
    {
        public static readonly DependencyProperty FrameNavigationStoryboardProperty
            = DependencyProperty.RegisterAttached(
                "FrameNavigationStoryboard",
                typeof(Storyboard),
                typeof(FrameAnimator),
                new FrameworkPropertyMetadata(null, OnFrameNavigationStoryboardChanged));

        private static void OnFrameNavigationStoryboardChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        {
            if (d is Frame frame && e.OldValue != e.NewValue)
            {
                frame.Navigating -= Frame_Navigating;
                if (e.NewValue is Storyboard)
                {
                    frame.Navigating += Frame_Navigating;
                }
            }
        }

        private static void Frame_Navigating(object sender, System.Windows.Navigation.NavigatingCancelEventArgs e)
        {
            if (sender is Frame frame)
            {
                var sb = GetFrameNavigationStoryboard(frame);
                if (sb != null)
                {
                    var presenter = frame.FindChild<ContentPresenter>();
                    sb.Begin((FrameworkElement)presenter ?? frame);
                }
            }
        }

        /// <summary>Helper for setting <see cref="FrameNavigationStoryboardProperty"/> on <paramref name="control"/>.</summary>
        /// <param name="control"><see cref="DependencyObject"/> to set <see cref="FrameNavigationStoryboardProperty"/> on.</param>
        /// <param name="storyboard">FrameNavigationStoryboard property value.</param>
        public static void SetFrameNavigationStoryboard(DependencyObject control, Storyboard storyboard)
        {
            control.SetValue(FrameNavigationStoryboardProperty, storyboard);
        }

        /// <summary>Helper for getting <see cref="FrameNavigationStoryboardProperty"/> from <paramref name="control"/>.</summary>
        /// <param name="control"><see cref="DependencyObject"/> to read <see cref="FrameNavigationStoryboardProperty"/> from.</param>
        /// <returns>FrameNavigationStoryboard property value.</returns>
        [AttachedPropertyBrowsableForType(typeof(DependencyObject))]
        public static Storyboard GetFrameNavigationStoryboard(DependencyObject control)
        {
            return (Storyboard)control.GetValue(FrameNavigationStoryboardProperty);
        }
    }
}
