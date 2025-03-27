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
using ICSharpCode.AvalonEdit;
using Prism.Commands;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using ICSharpCode.AvalonEdit.CodeCompletion;
using ICSharpCode.AvalonEdit.Document;
using ICSharpCode.AvalonEdit.Editing;

namespace Dm8Main.Views
{
    public class TokenizingEditCompletionData : ICompletionData
    {
        private readonly TokenizingEditControl control;

        public TokenizingEditCompletionData(string text, TokenizingEditControl control)
        {
            this.Text = text;
            this.control = control;
        }

        public System.Windows.Media.ImageSource Image
        {
            get { return null; }
        }

        public string Text { get; private set; }

        // Use this property if you want to show a fancy UIElement in the list.
        public object Content
        {
            get { return this.Text; }
        }

        public object Description
        {
            get { return "Description for " + this.Text; }
        }

        public double Priority
        {
            get;
        }

        public void Complete(TextArea textArea, ISegment completionSegment,
            EventArgs insertionRequestEventArgs)
        {
            string restOfText = this.Text.Substring(completionSegment.Offset);
            //textArea.Document.Replace(completionSegment, restOfText);
            textArea.Selection.ReplaceSelectionWithText(restOfText);
            this.control.textEditor.CaretOffset = completionSegment.EndOffset;
            this.control.textEditor.SelectionStart = completionSegment.EndOffset;
            this.control.textEditor.SelectionLength = restOfText.Length;

            // Open code completion after the user has pressed dot:
            this.control.completionWindow = new CompletionWindow(textArea);
            this.control.completionWindow.CloseAutomatically = false;
            foreach (var data in this.control.completionData)
            {
                this.control.completionWindow.CompletionList.CompletionData.Add(data);
            }

            this.control.completionWindow.Show();
            this.control.completionWindow.Closed += delegate {
                this.control.completionWindow = null;
            };
        }
    }

    public class TokenizingEditControlItem : Prism.Mvvm.BindableBase
    {
        public TokenizingEditControl Control { get; set; }

        #region Property IsEdit
        public bool IsEdit
        {
            get => this.isEdit;
            set => this.SetProperty(ref this.isEdit, value);
        }

        private bool isEdit;
        #endregion

        #region Property OldValue
        public string OldValue
        {
            get => this.oldValue;
            set => this.SetProperty(ref this.oldValue, value);
        }

        private string oldValue;
        #endregion

        #region Property Value
        public string Value
        {
            get => this.value;
            set => this.SetProperty(ref this.value, value);
        }

        private string value;
        #endregion

        #region Property LoadedCommand
        public DelegateCommand<RoutedEventArgs> LoadedCommand
        {
            get => this.loadedCommand;
            set => this.SetProperty(ref this.loadedCommand, value);
        }

        private DelegateCommand<RoutedEventArgs> loadedCommand;
        #endregion

        #region Property UnloadedCommand
        public DelegateCommand<RoutedEventArgs> UnloadedCommand
        {
            get => this.unloadedCommand;
            set => this.SetProperty(ref this.unloadedCommand, value);
        }

        private DelegateCommand<RoutedEventArgs> unloadedCommand;
        #endregion

        #region Property KeyDownCommand
        public DelegateCommand<KeyEventArgs> KeyDownCommand
        {
            get => this.keyDownCommand;
            set => this.SetProperty(ref this.keyDownCommand, value);
        }

        private DelegateCommand<KeyEventArgs> keyDownCommand;
        #endregion

        #region Property ClickCommand
        public DelegateCommand<RoutedEventArgs> ClickCommand
        {
            get => this.clickCommand;
            set => this.SetProperty(ref this.clickCommand, value);
        }

        private DelegateCommand<RoutedEventArgs> clickCommand;
        #endregion

        public TokenizingEditControlItem()
        {
            this.LoadedCommand = new DelegateCommand<RoutedEventArgs>(LoadedMethod);
            this.UnloadedCommand = new DelegateCommand<RoutedEventArgs>(UnloadedMethod);
            this.KeyDownCommand = new DelegateCommand<KeyEventArgs>(KeyDownMethod);
            this.ClickCommand = new DelegateCommand<RoutedEventArgs>(ClickMethod);
            this.PropertyChanged += OnPropertyChanged;


        }

        private void ClickMethod(RoutedEventArgs obj)
        {
            this.Control.RemoveItem(this);
        }

        private void OnPropertyChanged(object? sender, PropertyChangedEventArgs e)
        {
            switch (e.PropertyName)
            {
                case nameof(IsEdit):
                    if (this.IsEdit)
                    {
                        this.OldValue = this.Value;
                    }
                    else
                    {
                        if (string.IsNullOrWhiteSpace(this.Value))
                            this.Control.RemoveItem(this);
                        this.Control.CloseEdit();
                    }
                    break;
            }
        }


        private void KeyDownMethod(KeyEventArgs args)
        {
            switch (args.Key)
            {
                case Key.Enter:
                    args.Handled = true;
                    this.IsEdit = false;
                    break;

                case Key.Escape:
                    args.Handled = true;
                    this.Value = this.OldValue;
                    this.IsEdit = false;
                    break;
            }

        }

        private void LoadedMethod(RoutedEventArgs args)
        {
            if (args.OriginalSource is TextEditor textEditor)
            {
                textEditor.Focus();
                textEditor.TextArea.TextEntering += TextAreaOnTextEntering;
                textEditor.TextArea.TextEntered += TextAreaOnTextEntered;
                this.Control.textEditor = textEditor;
                this.Control.completionWindow = null;
            }

        }

        private void UnloadedMethod(RoutedEventArgs args)
        {
            if (args.OriginalSource is TextEditor textEditor)
            {
                textEditor.TextArea.TextEntering -= TextAreaOnTextEntering;
                textEditor.TextArea.TextEntered -= TextAreaOnTextEntered;
            }
            this.Control.textEditor = null;
            this.Control.completionWindow = null;
        }

        private void TextAreaOnTextEntering(object sender, TextCompositionEventArgs e)
        {
            if (!(e.OriginalSource is TextArea))
                return;

            var textArea = (e.OriginalSource as TextArea);
#if COMPLETION
            if (textArea.Document.TextLength > 5)
            {
                // Open code completion after the user has pressed dot:
                this.Control.completionWindow = new CompletionWindow(textArea);
                this.Control.completionWindow.CloseAutomatically = false;
                foreach (var data in this.Control.completionData)
                {
                    this.Control.completionWindow.CompletionList.CompletionData.Add(data);
                }

                this.Control.completionWindow.Show();
                this.Control.completionWindow.Closed += delegate {
                    this.Control.completionWindow = null;
                };
            }
#endif
        }

        private void TextAreaOnTextEntered(object sender, TextCompositionEventArgs e)
        {
            if (e.Text.Length > 0 && this.Control.completionWindow != null)
            {
                if (!char.IsLetterOrDigit(e.Text[0]))
                {
                    // Whenever a non-letter is typed while the completion window is open,
                    // insert the currently selected element.
                    this.Control.completionWindow.CompletionList.RequestInsertion(e);
                }
            }
        }





    }

    /// <summary>
    /// Follow steps 1a or 1b and then 2 to use this custom control in a XAML file.
    ///
    /// Step 1a) Using this custom control in a XAML file that exists in the current project.
    /// Add this XmlNamespace attribute to the root element of the markup file where it is
    /// to be used:
    ///
    ///     xmlns:MyNamespace="clr-namespace:TokenizingEditControl"
    ///
    ///
    /// Step 1b) Using this custom control in a XAML file that exists in a different project.
    /// Add this XmlNamespace attribute to the root element of the markup file where it is
    /// to be used:
    ///
    ///     xmlns:MyNamespace="clr-namespace:TokenizingEditControl;assembly=TokenizingEditControl"
    ///
    /// You will also need to add a project reference from the project where the XAML file lives
    /// to this project and Rebuild to avoid compilation errors:
    ///
    ///     Right click on the target project in the Solution Explorer and
    ///     "Add Reference"->"Projects"->[Browse to and select this project]
    ///
    ///
    /// Step 2)
    /// Go ahead and use your control in the XAML file.
    ///
    ///     <MyNamespace:CustomControl1/>
    ///
    /// </summary>
    public class TokenizingEditControl : ContentControl
    {
        private const string Grid = "PART_Grid";

        private const string ListView = "PART_ListView";

        public TextEditor textEditor { get; set; }

        public CompletionWindow completionWindow { get; set; }

        public IList<ICompletionData> completionData { get; set; }

        public ObservableCollection<string> Items
        {
            get { return (ObservableCollection<string>)GetValue(ItemsProperty); }
            set { SetValue(ItemsProperty, value); }
        }

        // Using a DependencyProperty as the backing store for Functions.  This enables animation, styling, binding, etc...
        public static readonly DependencyProperty ItemsProperty =
            DependencyProperty.Register("Items", typeof(ObservableCollection<string>), typeof(TokenizingEditControl), new PropertyMetadata(null, ItemsChangedHandler));

        private static void ItemsChangedHandler(DependencyObject d, DependencyPropertyChangedEventArgs e)
        {
            if (d is TokenizingEditControl tokenizingEditControl && tokenizingEditControl.listView != null)
            {
                tokenizingEditControl.InitItems();
            }
        }


        static TokenizingEditControl()
        {
            DefaultStyleKeyProperty.OverrideMetadata(typeof(TokenizingEditControl),
                new FrameworkPropertyMetadata(typeof(TokenizingEditControl)));
        }

        protected ListView listView;

        protected bool initList = false;

        public TokenizingEditControl()
        {
            this.completionData = new List<ICompletionData>();
            this.completionData.Add(new TokenizingEditCompletionData("My Text abc", this));
            this.completionData.Add(new TokenizingEditCompletionData("My Text def", this));
            this.completionData.Add(new TokenizingEditCompletionData("My Text gih", this));
        }




        public override void OnApplyTemplate()
        {
            base.OnApplyTemplate();
            this.listView = this.GetTemplateChild(ListView) as ListView;
            this.listView.MouseDoubleClick += ListViewOnMouseDoubleClick;
            this.listView.SelectionChanged += ListViewOnSelectionChanged;
            this.listView.LostFocus += ListViewOnLostFocus;
            this.InitItems();
        }




        private void InitItems()
        {
            this.initList = true;
            try
            {

                this.listView.Items.Clear();
                if (this.Items != null)
                {
                    foreach (var item in this.Items)
                    {
                        this.listView.Items.Add(new TokenizingEditControlItem { Control = this, IsEdit = false, Value = item });
                    }
                }
            }
            finally
            {
                this.initList = false;
            }

        }

        public void CloseEdit()
        {
            if (this.initList)
                return;

            foreach (var item in this.listView.Items.OfType<TokenizingEditControlItem>().ToList())
            {
                if (item.IsEdit)
                    item.IsEdit = false;
            }

            int i = 0;
            foreach (var item in this.listView.Items.OfType<TokenizingEditControlItem>())
            {
                if (i < this.Items?.Count())
                {
                    if (!string.Equals(this.Items[i], item.Value))
                    {
                        this.Items[i] = item.Value;
                    }
                }
                else
                {
                    this.Items.Add(item.Value);
                }
                i++;
            }

            for (int d = i; d< this.Items.Count(); d++)
            {
                this.Items.RemoveAt(d);
            }
        }


        private void ListViewOnLostFocus(object sender, RoutedEventArgs e)
        {
            if (e.OriginalSource is TextArea)
            {
                this.CloseEdit();
            }
        }

        private void ListViewOnSelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            this.CloseEdit();
        }

        private void ListViewOnMouseDoubleClick(object sender, MouseButtonEventArgs e)
        {
            if (e.OriginalSource is TextBlock || e.OriginalSource is Border)
            {
                if (this.listView.SelectedItem is TokenizingEditControlItem doubleClicktokenizingEditControlItem)
                {
                    this.CloseEdit();
                    doubleClicktokenizingEditControlItem.IsEdit = true;
                }

            }
            else
            {
                this.listView.Items.Add(new TokenizingEditControlItem { Control = this, IsEdit = true, Value = "" });
            }
        }

        public void RemoveItem(TokenizingEditControlItem tokenizingEditControlItem)
        {
            this.listView.Items.Remove(tokenizingEditControlItem);
            this.Items.Remove(tokenizingEditControlItem.Value);
        }
    }
}
