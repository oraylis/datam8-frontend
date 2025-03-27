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
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Composition;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Dm8Data.Helper;
using Dm8Data;
using Dm8Main.Models;
using Dm8Main.Services;
using Prism.Commands;
using Prism.Events;
using Unity;

#region Pragma
#pragma warning disable CA2021
#endregion

namespace Dm8Main.ViewModels
{
    [Export]
    public class GitViewModel : AnchorViewModel
    {
        private readonly Solution solution;

        private readonly IEventAggregator eventAggregator;

        private readonly ISolutionService solutionService;

        #region Property CanRunGit
        public bool CanRunGit
        {
            get => this.canRunGit;
            set => this.SetProperty(ref this.canRunGit, value);
        }

        private bool canRunGit;
        #endregion

        #region Property Branches
        public List<string> Branches
        {
            get => this.branches;
            set => this.SetProperty(ref this.branches, value);
        }

        private List<string> branches;
        #endregion

        #region Property GitItems
        public ObservableCollection<GitItem> GitItems
        {
            get => this.gitItems;
            set => this.SetProperty(ref this.gitItems, value);
        }

        private ObservableCollection<GitItem> gitItems;
        #endregion

        #region Property SearchText
        public string SearchText
        {
            get => this.searchText;
            set => this.SetProperty(ref this.searchText, value);
        }

        private string searchText;
        #endregion

        #region Property Message
        public string Message
        {
            get => this.message;
            set => this.SetProperty(ref this.message, value);
        }

        private string message;
        #endregion

        #region Property CommitCommand
        public DelegateCommand CommitCommand
        {
            get => this.commitCommand;
            set => this.SetProperty(ref this.commitCommand, value);
        }

        private DelegateCommand commitCommand;
        #endregion

        #region Property RefreshBranchCommand
        public DelegateCommand RefreshBranchCommand
        {
            get => this.refreshBranchCommand;
            set => this.SetProperty(ref this.refreshBranchCommand, value);
        }

        private DelegateCommand refreshBranchCommand;
        #endregion

        #region Property PushCommand
        public DelegateCommand PushCommand
        {
            get => this.pushCommand;
            set => this.SetProperty(ref this.pushCommand, value);
        }

        private DelegateCommand pushCommand;
        #endregion

        #region Property PullCommand
        public DelegateCommand PullCommand
        {
            get => this.pullCommand;
            set => this.SetProperty(ref this.pullCommand, value);
        }

        private DelegateCommand pullCommand;
        #endregion

        #region Property SyncCommand
        public DelegateCommand SyncCommand
        {
            get => this.syncCommand;
            set => this.SetProperty(ref this.syncCommand, value);
        }

        private DelegateCommand syncCommand;
        #endregion

        public GitViewModel(IUnityContainer container, ISolutionService solutionService, IEventAggregator eventAggregator)
        {
            // readonly variables
            this.solutionService = solutionService;
            this.eventAggregator = eventAggregator;
            this.solution = this.solutionService.Solution;
            if (this.solution == null)
                throw new ArgumentNullException(nameof(this.solution));

            // register events
            this.eventAggregator.GetEvent<RefreshSolution>().Subscribe((i) => System.Windows.Application.Current.Dispatcher.InvokeAsync(() => this.SaveSolution()));
            this.eventAggregator.GetEvent<SaveSolution>().Subscribe((i) => System.Windows.Application.Current.Dispatcher.InvokeAsync(() => this.SaveSolution()));

            // initialize properties
            this.CanRunGit = true;
            this.Title = Properties.Resources.Title_Git;

            // initialize commands
            this.RefreshBranchCommand = new DelegateCommand(executeMethod: async () => await this.RefreshBranchAsync());
            this.CommitCommand = new DelegateCommand(executeMethod: async () => await this.CommitAsync());
            this.PullCommand = new DelegateCommand(executeMethod: async () => await this.PullAsync());
            this.PushCommand = new DelegateCommand(executeMethod: async () => await this.PushAsync());
            this.SyncCommand = new DelegateCommand(executeMethod: async () => await this.SyncAsync());

            // register events and start
            this.PropertyChanged += this.GitViewModel_PropertyChanged;
            System.Windows.Application.Current.Dispatcher.BeginInvoke(method: async () => await this.QueryGitStatusAsync());
        }



        private void GitViewModel_PropertyChanged(object? sender, PropertyChangedEventArgs e)
        {
            switch (e.PropertyName)
            {
                case nameof(this.SearchText):
                    this.FilterGitTree();
                    break;
            }
        }

        public override async Task SaveAsync()
        {
            await Task.Yield();
        }

        private void SaveSolution()
        {
            System.Windows.Application.Current.Dispatcher.BeginInvoke(async () => await this.QueryGitStatusAsync());
        }

        private void FilterGitTree()
        {
            foreach (var projectItem in this.GitItems)
            {
                if (string.IsNullOrEmpty(this.SearchText))
                    projectItem.ResetFilter();
                else
                    projectItem.Filter(pi => pi.Name.ToLowerInvariant().Contains(this.SearchText.ToLowerInvariant()));
            }
        }


        private async Task QueryGitStatusAsync()
        {
            this.CanRunGit = false;
            try
            {
                await this.solutionService.GitHelper.QueryGitStatusAsync(this.solutionService.GitPath, this.solution);
                this.UpdateGitStatus();
            }
            finally
            {
                this.CanRunGit = true;
            }
        }

        private async Task RefreshBranchAsync()
        {
            this.CanRunGit = false;
            try
            {
                await this.solutionService.GitHelper.GitFetch(this.solutionService.GitPath, this.solution);
                this.UpdateGitStatus();
            }
            finally
            {
                this.CanRunGit = true;
            }
        }


        private async Task CommitAsync()
        {
            this.CanRunGit = false;
            try
            {
                await this.solutionService.GitHelper.GitCommit(this.solutionService.GitPath, this.solution, this.Message);
                this.UpdateGitStatus();
                var changedItems = this.IterateAllGitItems().Any(i => i.GitStatus != GitHelper.GitStatus.Unchanged && i.GitStatus != GitHelper.GitStatus.NoGit);
                if (!changedItems)
                {
                    this.Message = String.Empty;
                }
            }
            finally
            {
                this.CanRunGit = true;
            }
        }


        private async Task SyncAsync()
        {
            await this.PullAsync();
            await this.PushAsync();
        }

        private async Task PushAsync()
        {
            this.CanRunGit = false;
            try
            {
                await this.solutionService.GitHelper.GitPush(this.solutionService.GitPath, this.solution);
                this.UpdateGitStatus();
            }
            finally
            {
                this.CanRunGit = true;
            }
        }

        private async Task PullAsync()
        {
            this.CanRunGit = false;
            try
            {
                await this.solutionService.GitHelper.GitPull(this.solutionService.GitPath, this.solution);
                this.UpdateGitStatus();
            }
            finally
            {
                this.CanRunGit = true;
            }
        }


        private void UpdateGitStatus()
        {
            this.eventAggregator.GetEvent<GitChangeEvent>().Publish(this.solutionService.GitHelper);

            // set branch
            var newBranches = new List<string>();
            foreach (var repo in this.solutionService.GitHelper.Repositories)
            {
                newBranches.Add(repo.BranchStatus);
            }
            this.Branches = newBranches;

            var gitItems = new ObservableCollection<GitItem>();
            foreach (var repo in this.solutionService.GitHelper.Repositories)
            {
                var repoItem = new GitItem(GitItem.GitType.Repo, GitHelper.GitStatus.Unchanged, this.solutionService, $"{repo.NamePush} [{repo.RootFolder}]", repo.RootFolder);
                foreach (var item in repo.FileStatus)
                {
                    this.AddFolderPath(repoItem, item.Key, item.Value);
                }
                gitItems.Add(repoItem);
            }
            this.GitItems = gitItems;
        }

        private IEnumerable<GitItem> IterateAllGitItems(IEnumerable<GitItem> gitItemsParam = null)
        {
            gitItemsParam = gitItemsParam ?? this.GitItems;

            foreach (var item in gitItemsParam)
            {
                yield return item;
                foreach (var subItem in this.IterateAllGitItems(item.Children.OfType<GitItem>()))
                {
                    yield return subItem;
                }
            }
        }

        private void AddFolderPath(GitItem repoItem, string file, GitHelper.GitStatus value)
        {
            var path = file.Replace(repoItem.FilePath, "");
            var pathComp = path.Split(Path.DirectorySeparatorChar);
            var fullPath = repoItem.filePath;
            var folder = repoItem;
            foreach (var p in pathComp)
            {
                if (string.IsNullOrEmpty(p))
                    continue;
                fullPath = Path.Combine(fullPath, p);

                var folderNew = folder.Children.OfType<GitItem>().Where(c => StringComparer.InvariantCultureIgnoreCase.Equals(c.Name, p)).FirstOrDefault();
                if (folderNew == null && fullPath != file)
                {
                    folderNew = new GitItem(GitItem.GitType.Folder, GitHelper.GitStatus.Unchanged, this.solutionService, p, fullPath);
                    folder.Children.Add(folderNew);
                }
                else if (folderNew == null && fullPath == file)
                {
                    folderNew = new GitItem(GitItem.GitType.File, value, this.solutionService, p, fullPath);
                    folder.Children.Add(folderNew);
                }
                folder = folderNew;
            }


        }
    }
}
