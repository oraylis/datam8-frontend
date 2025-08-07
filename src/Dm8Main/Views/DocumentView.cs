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
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using Dm8Main.ViewModels;
using ICSharpCode.AvalonEdit;
using ICSharpCode.AvalonEdit.Search;
using MvvmDialogs;
using Newtonsoft.Json;

namespace Dm8Main.Views
{
   /// <summary>
   /// Follow steps 1a or 1b and then 2 to use this custom control in a XAML file.
   ///
   /// Step 1a) Using this custom control in a XAML file that exists in the current project.
   /// Add this XmlNamespace attribute to the root element of the markup file where it is
   /// to be used:
   ///
   ///     xmlns:MyNamespace="clr-namespace:Dm8Main.Views"
   ///
   ///
   /// Step 1b) Using this custom control in a XAML file that exists in a different project.
   /// Add this XmlNamespace attribute to the root element of the markup file where it is
   /// to be used:
   ///
   ///     xmlns:MyNamespace="clr-namespace:Dm8Main.Views;assembly=Dm8Main.Views"
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
   ///     <MyNamespace:JsonEdit/>
   ///
   /// </summary>
   public class DocumentView:ContentControl
   {
      private const string SplitGrid = "PART_SplitGrid";
      private const string SplitGridSplitter = "PART_SplitGridSplitter";
      private const string ButtonDesign = "PART_ButtonDesign";
      private const string ButtonJson = "PART_ButtonEdit";
      private const string Design = "PART_Design";
      private const string Buttons = "PART_Buttons";
      private const string Edit = "PART_Edit";
      private const string ButtonError = "PART_ButtonError";
      private const string ErrorList = "PART_ErrorList";


      private Grid grid;
      private GridSplitter splitGridSplitter;
      private ToggleButton designButton;
      private ToggleButton editButton;
      private ToggleButton errorButton;
      private ListView errorList;
      private ContentControl design;
      private TextEditor edit;

      public ICommand EditCommand
      {
         get => (ICommand)GetValue(EditCommandProperty);
         set => SetValue(EditCommandProperty ,value);
      }

      // Using a DependencyProperty as the backing store for EditCommand.  This enables animation, styling, binding, etc...
      public static readonly DependencyProperty EditCommandProperty =
          DependencyProperty.Register("EditCommand" ,typeof(ICommand) ,typeof(DocumentView) ,new PropertyMetadata(null));


      static DocumentView()
      {
         DefaultStyleKeyProperty.OverrideMetadata(typeof(DocumentView) ,new FrameworkPropertyMetadata(typeof(DocumentView)));

      }

      public DocumentView()
      {
         this.Name = "Self";
         this.SetCurrentValue(DialogServiceViews.IsRegisteredProperty ,true);
         DialogServiceViews.SetIsRegistered(this ,true);
         var tst = DialogServiceViews.GetIsRegistered(this);
      }

      public DocumentViewModelBase ViewModel => (DocumentViewModelBase)this.DataContext;

      public override void OnApplyTemplate()
      {
         base.OnApplyTemplate();

         this.grid = this.GetTemplateChild(SplitGrid) as Grid;
         this.splitGridSplitter = this.GetTemplateChild(SplitGridSplitter) as GridSplitter;
         this.designButton = this.GetTemplateChild(ButtonDesign) as ToggleButton;
         this.editButton = this.GetTemplateChild(ButtonJson) as ToggleButton;
         this.design = this.GetTemplateChild(Design) as ContentControl;
         this.edit = this.GetTemplateChild(Edit) as TextEditor;
         this.errorButton = this.GetTemplateChild(ButtonError) as ToggleButton;
         this.errorList = this.GetTemplateChild(ErrorList) as ListView;

         this.designButton.Checked += this.DesignButton_Checked;
         this.designButton.Unchecked += this.DesignButton_Checked;
         this.editButton.Checked += this.EditButton_Checked;
         this.editButton.Unchecked += this.EditButton_Checked;
         this.splitGridSplitter.DragCompleted += this.SplitGridSplitter_DragCompleted;
         this.errorList.MouseDoubleClick += this.ErrorList_MouseDoubleClick;

         SearchPanel.Install(this.edit);

         // by default design only
         this.designButton.IsChecked = true;
      }

      private void ErrorList_MouseDoubleClick(object sender ,MouseButtonEventArgs e)
      {
         switch (this.errorList.SelectedItem)
         {
            case JsonReaderException jsonReaderException:
               {
                  var l = 1;
                  var p = 1;
                  foreach (var c in this.edit.Text)
                  {
                     if (c == '\r')
                        l++;

                     if (l == jsonReaderException.LineNumber)
                        break;
                     p++;
                  }
                  this.edit.CaretOffset = p + jsonReaderException.LinePosition;
                  this.errorButton.IsChecked = false;
                  this.edit.Focus();
                  break;
               }
            case JsonSerializationException jsonSerializationException:
               {
                  var l = 1;
                  var p = 1;
                  foreach (var c in this.edit.Text)
                  {
                     if (c == '\r')
                        l++;

                     if (l == jsonSerializationException.LineNumber)
                        break;
                     p++;
                  }
                  this.edit.CaretOffset = p + jsonSerializationException.LinePosition;
                  this.errorButton.IsChecked = false;
                  this.edit.Focus();
                  break;
               }
         }
      }


      private void SplitGridSplitter_DragCompleted(object sender ,DragCompletedEventArgs e)
      {
         this.HandleDrag(e.VerticalChange);
      }

      private void HandleDrag(double verticalChange)
      {
         if (this.grid.RowDefinitions[2].ActualHeight - verticalChange <= 0)
         {
            this.ShowDesignOnly();
         } else if (this.grid.RowDefinitions[0].ActualHeight + verticalChange <= 0)
         {
            this.ShowEditOnly();
         } else
         {
            this.ShowDesignAndEdit();
         }
      }

      private void ShowDesignAndEdit()
      {
         this.designButton.IsChecked = false;
         this.editButton.IsChecked = false;
         this.design.Visibility = Visibility.Visible;
         this.edit.Visibility = Visibility.Visible;
         Grid.SetRow(this.edit ,2);
      }



      private void ShowDesignOnly()
      {
         this.designButton.IsChecked = true;
         this.editButton.IsChecked = false;
         this.design.Visibility = Visibility.Visible;
         this.edit.Visibility = Visibility.Collapsed;
         Grid.SetRow(this.edit ,2);
         this.grid.RowDefinitions[0].Height = new GridLength(1.0 ,GridUnitType.Star);
         this.grid.RowDefinitions[2].Height = new GridLength(0.0 ,GridUnitType.Star);
      }

      private void ShowEditOnly()
      {
         this.designButton.IsChecked = false;
         this.editButton.IsChecked = true;
         this.design.Visibility = Visibility.Collapsed;
         this.edit.Visibility = Visibility.Visible;
         Grid.SetRow(this.edit ,0);
         this.grid.RowDefinitions[0].Height = new GridLength(1.0 ,GridUnitType.Star);
         this.grid.RowDefinitions[2].Height = new GridLength(0.0 ,GridUnitType.Star);
      }

      private void EditButton_Checked(object sender ,RoutedEventArgs e)
      {
         if (this.editButton.IsChecked ?? false)
         {
            this.designButton.IsChecked = false;
            this.ShowEditOnly();
         }
         if (!(this.editButton.IsChecked ?? false) && !(this.designButton.IsChecked ?? false))
         {
            this.grid.RowDefinitions[0].Height = new GridLength(1.0 ,GridUnitType.Star);
            this.grid.RowDefinitions[2].Height = new GridLength(1.0 ,GridUnitType.Star);
            this.ShowDesignAndEdit();
         }
      }

      private void DesignButton_Checked(object sender ,RoutedEventArgs e)
      {
         if (this.designButton.IsChecked ?? false)
         {
            this.editButton.IsChecked = false;
            this.ShowDesignOnly();
         }
         if (!(this.editButton.IsChecked ?? false) && !(this.designButton.IsChecked ?? false))
         {
            this.grid.RowDefinitions[0].Height = new GridLength(1.0 ,GridUnitType.Star);
            this.grid.RowDefinitions[2].Height = new GridLength(1.0 ,GridUnitType.Star);
            this.ShowDesignAndEdit();
         }
      }
   }
}
