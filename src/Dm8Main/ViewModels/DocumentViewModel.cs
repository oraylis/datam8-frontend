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
using System.Collections;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.ComponentModel;
using System.Composition;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;
using Dm8Data.Helper;
using Dm8Data.Validate;
using Dm8Data.Validate.Exceptions;
using Dm8Main.Base;
using Dm8Main.Properties;
using Dm8Main.Services;
using MvvmDialogs;
using Prism.Events;
using Unity;

namespace Dm8Main.ViewModels
{


   [Export]
   public abstract class DocumentViewModel<TObj>:DocumentViewModelBase
       where TObj : Prism.Mvvm.BindableBase, new()
   {
      protected readonly IUnityContainer unityContainer;

      protected readonly Dm8Data.Solution solution;

      protected bool updatingItems = false;

      protected bool updatingJson = false;

      #region Property Item
      public TObj Item
      {
         get => this.item;
         set => this.SetProperty(ref this.item ,value);
      }

      public TObj item;
      #endregion


      public DocumentViewModel(IUnityContainer unityContainer ,ISolutionService solutionService ,IEventAggregator eventAggregator ,IDialogService dialogService)
          : base(solutionService ,eventAggregator ,dialogService)
      {
         this.unityContainer = unityContainer;
         this.dialogService = dialogService;
         this.solutionService = solutionService;
         this.solution = this.solutionService.Solution;
         if (this.solution == null)
            throw new ArgumentNullException(nameof(this.solution));

         this.eventAggregator = eventAggregator;
         base.solutionService.PropertyChanged += this.SolutionServicePropertyChanged;

         this.IsModified = false;
         this.PropertyChanged += this.DocumentViewModel_PropertyChanged;
      }


      protected override async Task CloseAsync()
      {
         if (this.IsModified)
         {
            var rc = this.ShowMessageBox(string.Format(Resources.Message_CloseAsync_Save ,
                    Path.GetFileNameWithoutExtension(this.FilePath)) ,
                "Save Changes" ,MessageBoxButton.YesNoCancel);
            if (rc == MessageBoxResult.Cancel)
            {
               return;
            }

            if (rc == MessageBoxResult.Yes)
            {
               await this.SaveAsync();
            }

         }
         await base.CloseAsync();
      }

      private void SolutionServicePropertyChanged(object sender ,PropertyChangedEventArgs e)
      {
         if (e.PropertyName == nameof(SolutionService.Theme))
         {
            // change syntax highlighting
         }
      }


      private async void DocumentViewModel_PropertyChanged(object sender ,PropertyChangedEventArgs e)
      {
         switch (e.PropertyName)
         {
            case nameof(JsonCode):
               await this.UpdateFromJsonCodeAsync();
               break;
         }
      }

      private async void Items_CollectionChanged(object sender ,NotifyCollectionChangedEventArgs e)
      {
         if (e.Action == NotifyCollectionChangedAction.Add && e.NewItems != null)
         {
            foreach (var n in e.NewItems.OfType<Prism.Mvvm.BindableBase>())
            {
               this.RegisterItemChanged(n);
            }
         }
         await this.UpdateFromItemAsync();
      }



      private async void Item_PropertyChanged(object sender ,PropertyChangedEventArgs e)
      {
         if (!this.IsSaving)
         {
            this.IsModified = true;

            await this.UpdateFromItemAsync();
         }
      }

      private void RegisterItemChanged(INotifyPropertyChanged n)
      {
         if (n == null)
            return;

         // register for property changes
         n.PropertyChanged += this.Item_PropertyChanged;

         // register sub objects
         foreach (var prop in n.GetType().GetProperties())
         {

            if (typeof(INotifyCollectionChanged).IsAssignableFrom(prop.PropertyType))
            {
               var collection = prop.GetValue(n) as INotifyCollectionChanged;
               if (collection != null)
               {
                  collection.CollectionChanged += this.Items_CollectionChanged;
               }
            } else if (typeof(INotifyPropertyChanged).IsAssignableFrom(prop.PropertyType))
            {
               var sub = (INotifyPropertyChanged)prop.GetValue(n);
               if (sub != null)
               {
                  this.RegisterItemChanged(sub);
               }
            }
            if (typeof(IEnumerable).IsAssignableFrom(prop.PropertyType) && prop.PropertyType != typeof(string))
            {
               var collection = prop.GetValue(n) as IEnumerable;
               if (collection != null)
               {
                  foreach (var sub in collection.OfType<INotifyPropertyChanged>())
                  {
                     this.RegisterItemChanged(sub);
                  }
               }
            }
         }
         // TODO recursive register
      }



      protected override async Task LoadInternalAsync()
      {
         this.LastWriteTimeUtc = DateTime.UtcNow;

         // reload from json directly (not via change event)
         this.PropertyChanged -= this.DocumentViewModel_PropertyChanged;
         this.IsLoading = true;
         try
         {
            // set properties
            this.FilePath = this.ProjectItem.FilePath;
            this.ToolTip =
                $"{this.ProjectItem.Type} - {this.ProjectItem.Name} ({this.ProjectItem.RelativeFilePath})";
            this.Title = this.ProjectItem.Name;

            // load file and items
            if (!File.Exists(this.FilePath))
            {
               await FileHelper.WriteFileAsync(this.FilePath ,string.Empty);
            }

            string jsonCode = await FileHelper.ReadFileAsync(this.FilePath);
            if (jsonCode != this.JsonCode || !this.IsJsonLoaded)
            {
               this.JsonCode = jsonCode;
               await this.UpdateFromJsonCodeAsync();
            } else
            {
               this.ErrorList = new ObservableCollection<ModelReaderException>();
               await this.ValidateAsync();
            }
            this.LastWriteTimeUtc = new FileInfo(this.FilePath).LastWriteTimeUtc;
         }
         finally
         {
            this.PropertyChanged += this.DocumentViewModel_PropertyChanged;
            this.IsLoading = false;
         }

         this.IsModified = false;
      }

      protected override async Task SaveInternalAsync()
      {
         // save file
         if (!this.IsModified)
            return;

         this.IsSaving = true;
         try
         {
            // save file
            await FileHelper.WriteFileAsync(this.FilePath ,this.JsonCode);
            this.IsModified = false;
            this.LastWriteTimeUtc = DateTime.UtcNow;

            // reload file if no save error
            await this.LoadInternalAsync();

            // check errors
            await this.ValidateAsync();
         } catch (Exception ex)
         {
            this.ErrorList = new ObservableCollection<ModelReaderException>();
            this.ErrorList.Add(new UnknownValidateException(ex ,this.FilePath));
         }
         finally
         {
            this.LastWriteTimeUtc = new FileInfo(this.FilePath).LastWriteTimeUtc;
            this.IsSaving = false;
         }
      }


      public override async Task ValidateAsync()
      {
         if (!this.IsJsonLoaded)
            return;

         try
         {
            var v = ModelReaderFactory.Create(typeof(TObj));
            var newErrorList = await v.ValidateObjectAsync(this.solutionService.SolutionHelper ,this.Item);
            this.ErrorList = new ObservableCollection<ModelReaderException>(this.ErrorList.Union(newErrorList));
         } catch (Exception ex)
         {
            this.dialogService.ShowException(this ,ex);
         }
      }

      public async Task UpdateFromJsonCodeAsync()
      {
         if (this.updatingItems || this.updatingJson)
         {
            return;
         }

         // queue event again
         if (this.updatingItems)
         {
            await Application.Current.Dispatcher.BeginInvoke(async () => await this.UpdateFromJsonCodeAsync() ,DispatcherPriority.ApplicationIdle);
            return;
         }

         this.updatingJson = true;
         this.ErrorList = new ObservableCollection<ModelReaderException>();
         var newItem = new TObj();
         var newErrorList = new List<ModelReaderException>();
         this.IsJsonLoaded = false;
         try
         {
            if (!string.IsNullOrWhiteSpace(this.JsonCode))
            {
               var v = ModelReaderFactory.Create(typeof(TObj)) as ModelReader<TObj>;
               newItem = await v.ReadFromStringAsync(this.JsonCode);
               this.RegisterItemChanged(newItem);
            }

            this.Item = newItem;
            this.IsJsonLoaded = true;
         } catch (AggregateException ex)
         {
            // clear other errors
            foreach (var childEx in ex.InnerExceptions)
            {
               if (childEx is ModelReaderException modelReaderException)
               {
                  modelReaderException.FilePath = this.FilePath;
                  newErrorList.Add(modelReaderException);
               } else
               {
                  newErrorList.Add(new UnknownValidateException(childEx ,this.FilePath));
               }

            }
         } catch (ModelReaderException ex)
         {
            ex.FilePath = this.FilePath;
            newErrorList.Add(ex);
         } catch (Exception ex)
         {
            newErrorList.Add(new UnknownValidateException(ex ,this.FilePath));
         }
         finally
         {
            this.ErrorList = new ObservableCollection<ModelReaderException>(this.ErrorList.Union(newErrorList));
            this.updatingJson = false;
            if (!this.IsLoading)
               this.IsModified = true;

            // set items
            this.Item = newItem;

            // check errors
            await this.ValidateAsync();
         }
      }



      public async Task UpdateFromItemAsync()
      {
         if (this.updatingJson)
         {
            return;
         }

         if (this.updatingItems)
         {
            await Application.Current.Dispatcher.BeginInvoke(async () => await this.UpdateFromItemAsync() ,DispatcherPriority.ApplicationIdle);
            return;
         }


         this.updatingItems = true;
         this.ErrorList = new ObservableCollection<ModelReaderException>();
         var newErrorList = new List<ModelReaderException>();
         try
         {
            string jsonCode = null;
            await Task.Factory.StartNew(() =>
            {
               jsonCode = FileHelper.MakeJson(this.Item);
            });
            this.JsonCode = jsonCode;
         } catch (Exception ex)
         {
            // json cannot be serialized -> why
            newErrorList.Add(new UnknownValidateException(ex ,this.FilePath));
         }
         finally
         {
            this.ErrorList = new ObservableCollection<ModelReaderException>(this.ErrorList.Union(newErrorList));
            this.updatingItems = false;
            if (!this.IsLoading)
               this.IsModified = true;

            // check errors
            await this.ValidateAsync();
         }
      }



   }
}
