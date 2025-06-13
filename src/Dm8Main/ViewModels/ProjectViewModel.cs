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
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Composition;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using Dm8Data;
using Dm8Main.Models;
using Dm8Main.Services;
using MahApps.Metro.IconPacks;
using MvvmDialogs;
using Prism.Commands;
using Prism.Events;
using Unity;

namespace Dm8Main.ViewModels
{
    [Export]
    public class ProjectViewModel : AnchorViewModel
    {
        private readonly IDialogService dialogService;

        private readonly IEventAggregator eventAggregator;

        private readonly ISolutionService solutionService;

        #region Property Solution
        public Solution Solution
        {
            get => solution;
            set => this.SetProperty(ref solution, value);
        }

        private Solution solution;
        #endregion

        #region Property ProjectItems
        public ObservableCollection<ProjectItem> ProjectItems
        {
            get => this.projectItems;
            set => this.SetProperty(ref this.projectItems, value);
        }

        private ObservableCollection<ProjectItem> projectItems;
        #endregion

        #region Property SelectedProjectItem
        public ProjectItem SelectedProjectItem
        {
            get => selectedProjectItem;
            set => this.SetProperty(ref selectedProjectItem, value);
        }

        private ProjectItem selectedProjectItem;
        #endregion

        #region Property IconSource
        public object IconSource
        {
            get => iconSource;
            set => this.SetProperty(ref iconSource, value);
        }

        private object iconSource;
        #endregion

        #region Property ItemOpenCommand
        public DelegateCommand<MouseButtonEventArgs> ItemOpenCommand
        {
            get => itemOpenCommand;
            set => this.SetProperty(ref itemOpenCommand, value);
        }

        private DelegateCommand<MouseButtonEventArgs> itemOpenCommand;
        #endregion

        #region Property SearchText
        public string SearchText
        {
            get => _searchText;
            set => this.SetProperty(ref _searchText, value);
        }

        private string _searchText;
        #endregion

        public ProjectViewModel(IUnityContainer container, IDialogService dialogService, ISolutionService solutionService, IEventAggregator eventAggregator)
        {
            this.dialogService = dialogService;
            this.eventAggregator = eventAggregator;
            this.solutionService = solutionService;
            this.Solution = this.solutionService.Solution;
            if (this.Solution == null)
            {
                throw new ArgumentNullException(nameof(this.Solution));
            }

            this.ProjectItems = this.solutionService.ProjectItems;
            if (this.ProjectItems == null)
            {
                throw new ArgumentNullException(nameof(this.ProjectItems));
            }
            this.Title = Properties.Resources.Title_Project;
            this.IconSource = new PackIconMaterial()
            {
                Kind = PackIconMaterialKind.SourceRepository,
                Foreground = this.solutionService.Theme == Base.ColorTheme.Dark ? Brushes.White : Brushes.Black,
                Width = 16,
                Height = 16,
                VerticalAlignment = VerticalAlignment.Center
            };
            this.ItemOpenCommand = new DelegateCommand<MouseButtonEventArgs>((o) => this.ItemOpen(o));
            this.PropertyChanged += this.ProjectViewModel_PropertyChanged;
        }

        private void ProjectViewModel_PropertyChanged(object? sender, PropertyChangedEventArgs e)
        {
            switch (e.PropertyName)
            {
                case nameof(this.SearchText):
                    this.FilterProjectTree();
                    break;
            }
        }

        private void ItemOpen(MouseButtonEventArgs o)
        {
            var item = ((Selector)o.Source).SelectedItem;
            if (item is ProjectItem projectItem)
            {
                switch (projectItem.Type)
                {
                    case ProjectItem.Types.Folder:
                    case ProjectItem.Types.RawSubFolder:
                    case ProjectItem.Types.GenerateSubFolder:
                        break;

                    default:
                        this.eventAggregator.GetEvent<OpenDocumentEvent>().Publish(projectItem);
                        break;
                }
            }
        }
        public void ItemSelect(ProjectItem projectItem)
        {
            switch (projectItem.Type)
            {
                case ProjectItem.Types.Folder:
                case ProjectItem.Types.RawSubFolder:
                case ProjectItem.Types.GenerateSubFolder:
                    break;

                default:
                    this.eventAggregator.GetEvent<SelectDocumentEvent>().Publish(projectItem);
                    break;
            }
        }

        public override async Task SaveAsync()
        {
            await Task.Yield();
        }

        private void FilterProjectTree()
        {
            foreach (var projectItem in this.solutionService.ProjectItems)
            {
                if (string.IsNullOrEmpty(this.SearchText))
                {
                    projectItem.ResetFilter();
                }
                else
                {
                    string search = this.SearchText.ToLowerInvariant();
                    projectItem.Filter(item =>
                    {
                        if (item is ProjectItem pi)
                        {
                            return (pi.Name != null && pi.Name.ToLowerInvariant().Contains(search)) ||
                                   (pi.DisplayName != null && pi.DisplayName.ToLowerInvariant().Contains(search));
                        }
                        return false;
                    });
                }
            }
        }
    }
}
