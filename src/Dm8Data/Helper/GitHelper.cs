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
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace Dm8Data.Helper
{
   public class GitHelper
   {
      public enum ProjectComponent
      {
         BaseDirectory
      }

      public enum GitStatus
      {
         NoGit,
         Added,
         Modified,
         Deleted,
         Unchanged
      }

      public class GitRepository
      {
         public string RootFolder { get; set; }

         public bool IsUpdated { get; set; }

         public string NameFetch { get; set; }

         public string NamePush { get; set; }

         public string Branch { get; set; }

         public string BranchStatus { get; internal set; }

         public List<string> RemoteBranches { get; set; }

         public List<string> PullBranches { get; set; }

         public List<string> PushBranches { get; set; }

         public Dictionary<string ,GitStatus> FileStatus { get; set; }

         public GitRepository(string rootFolder)
         {
            this.IsUpdated = true;
            this.RootFolder = rootFolder;
            this.FileStatus = new Dictionary<string ,GitStatus>();
            this.RemoteBranches = new List<string>();
            this.PushBranches = new List<string>();
            this.PullBranches = new List<string>();
         }
      }

      public List<GitRepository> Repositories { get; set; }

      public Action<string> ReportGit { get; set; }


      public GitHelper()
      {
         this.Repositories = new List<GitRepository>();
      }


      public async Task QueryGitStatusAsync(string gitPath ,Solution solution)
      {
         // query for all main directories
         if (this.ReportGit != null)
         {
            this.ReportGit(null);
         }

         await this.GitRefreshStatus(gitPath ,solution);
      }

      public async Task<bool> GitFetch(string gitPath ,Solution solution)
      {
         bool rc = true;
         if (this.ReportGit != null)
         {
            this.ReportGit(null);
         }

         rc &= await this.GitRun(gitPath ,solution ,"fetch" ,solution.BaseFilePath);
         rc &= await this.GitRun(gitPath ,solution ,"fetch" ,solution.RawFolderPath);
         rc &= await this.GitRun(gitPath ,solution ,"fetch" ,solution.OutputFolderPath);
         rc &= await this.GitRun(gitPath ,solution ,"fetch" ,solution.GenerateFolderPath);

         rc &= await this.GitRefreshStatus(gitPath ,solution);
         return rc;
      }


      public async Task<bool> GitCommit(string gitPath ,Solution solution ,string message)
      {
         bool rc = true;
         if (this.ReportGit != null)
         {
            this.ReportGit(null);
         }

         rc &= await this.GitCommit(gitPath ,solution ,solution.BaseFilePath ,message);
         rc &= await this.GitCommit(gitPath ,solution ,solution.RawFolderPath ,message);
         rc &= await this.GitCommit(gitPath ,solution ,solution.OutputFolderPath ,message);
         rc &= await this.GitCommit(gitPath ,solution ,solution.GenerateFolderPath ,message);

         rc = await this.GitRefreshStatus(gitPath ,solution);

         return rc;
      }

      public async Task<bool> GitPull(string gitPath ,Solution solution)
      {
         bool rc = true;
         if (this.ReportGit != null)
         {
            this.ReportGit(null);
         }

         rc &= await this.GitRun(gitPath ,solution ,"pull" ,solution.BaseFilePath);
         rc &= await this.GitRun(gitPath ,solution ,"pull" ,solution.RawFolderPath);
         rc &= await this.GitRun(gitPath ,solution ,"pull" ,solution.OutputFolderPath);
         rc &= await this.GitRun(gitPath ,solution ,"pull" ,solution.GenerateFolderPath);

         rc &= await this.GitRefreshStatus(gitPath ,solution);
         return rc;
      }

      public async Task<bool> GitPush(string gitPath ,Solution solution)
      {
         bool rc = true;
         if (this.ReportGit != null)
         {
            this.ReportGit(null);
         }

         rc &= await this.GitRun(gitPath ,solution ,"push" ,solution.BaseFilePath);
         rc &= await this.GitRun(gitPath ,solution ,"push" ,solution.RawFolderPath);
         rc &= await this.GitRun(gitPath ,solution ,"push" ,solution.CoreFolderPath);
         rc &= await this.GitRun(gitPath ,solution ,"push" ,solution.OutputFolderPath);
         rc &= await this.GitRun(gitPath ,solution ,"push" ,solution.GenerateFolderPath);

         rc &= await this.GitRefreshStatus(gitPath ,solution);
         return rc;
      }


      private async Task<bool> GitRefreshStatus(string gitPath ,Solution solution)
      {
         // query for all main directories
         foreach (var repository in this.Repositories)
         {
            repository.IsUpdated = false;
         }

         bool rc = true;
         rc &= await this.QueryGitStatusAsync(gitPath ,solution ,solution.BaseFilePath);
         rc &= await this.QueryGitStatusAsync(gitPath ,solution ,solution.RawFolderPath);
         rc &= await this.QueryGitStatusAsync(gitPath ,solution ,solution.OutputFolderPath);
         rc &= await this.QueryGitStatusAsync(gitPath ,solution ,solution.GenerateFolderPath);
         return rc;
      }

      public GitStatus GetFileStatus(string file)
      {
         foreach (var repo in this.Repositories)
         {
            if (file.StartsWith(repo.RootFolder ,StringComparison.InvariantCultureIgnoreCase))
            {
               if (repo.FileStatus.TryGetValue(file ,out GitStatus status))
               {
                  return status;
               }
               return GitStatus.Unchanged;
            }
         }
         return GitStatus.NoGit;
      }

      private async Task<bool> GitRun(string gitPath ,Solution solution ,string command ,string dir)
      {
         try
         {
            Directory.SetCurrentDirectory(dir);

            await ProcessExt.RunAsync(Path.Combine(gitPath ,"git.exe") ,command ,(s) => { if (this.ReportGit != null) { this.ReportGit(s); } });
            return true;
         } catch
         {
            return false;
         }
      }

      private async Task<bool> GitCommit(string gitPath ,Solution solution ,string dir ,string message)
      {
         try
         {
            Directory.SetCurrentDirectory(dir);

            await ProcessExt.RunAsync(Path.Combine(gitPath ,"git.exe") ,$"add --all" ,(s) => { if (this.ReportGit != null) { this.ReportGit(s); } });
            await ProcessExt.RunAsync(Path.Combine(gitPath ,"git.exe") ,$"commit -a -m \"{message}\"" ,(s) => { if (this.ReportGit != null) { this.ReportGit(s); } });
            return true;
         } catch
         {
            return false;
         }
      }

      private async Task<bool> QueryGitStatusAsync(string gitPath ,Solution solution ,string dir)
      {
         try
         {
            Directory.SetCurrentDirectory(dir);

            string rootLine = null;
            await ProcessExt.RunAsync(Path.Combine(gitPath ,"git.exe") ,"rev-parse --show-toplevel" ,(s) => rootLine = s);

            // no GIT repo
            if (rootLine?.StartsWith("fatal:") ?? true)
            {
               return false;
            }

            // directory already scanned
            rootLine = rootLine.Replace('\\' ,Path.DirectorySeparatorChar);
            rootLine = rootLine.Replace('/' ,Path.DirectorySeparatorChar);
            var repo = this.Repositories.Where(r => r.RootFolder == rootLine).FirstOrDefault();

            if (repo != null)
            {
               if (!repo.IsUpdated)
               {
                  repo.IsUpdated = true;
                  repo.FileStatus = new Dictionary<string ,GitStatus>();
                  await ProcessExt.RunAsync(Path.Combine(gitPath ,"git.exe") ,"status -s -b --porcelain --untracked-files" ,(s) => this.QueryGitFileLine(repo ,s));
               }
               return true;
            }

            // create new git repo
            repo = new GitRepository(rootLine);

            // scan name
            string context = null;
            await ProcessExt.RunAsync(Path.Combine(gitPath ,"git.exe") ,"remote show origin" ,(s) => this.QueryGitStatusLine(repo ,ref context ,s));

            // scan files
            await ProcessExt.RunAsync(Path.Combine(gitPath ,"git.exe") ,"status -s -b --porcelain --untracked-files" ,(s) => this.QueryGitFileLine(repo ,s));
            this.Repositories.Add(repo);
            return true;
         } catch
         {
            return false;
         }
      }


      private void QueryGitStatusLine(GitRepository repo ,ref string context ,string s)
      {
         if (this.ReportGit != null)
         {
            this.ReportGit(s);
         }

         if (s.Trim().StartsWith("Fetch URL:"))
         {
            var split = s.Split(' ');
            repo.NameFetch = split?.Last();
         } else if (s.Trim().StartsWith("Push  URL:"))
         {
            var split = s.Split(' ');
            repo.NamePush = split?.Last();
         } else if (s.Trim().StartsWith("HEAD branch:"))
         {
            var split = s.Split(' ');
            repo.Branch = split?.Last();
         } else if (s.Trim().StartsWith("HEAD branch:"))
         {
            var split = s.Split(' ');
            repo.Branch = split?.Last();
         }

         if (s.Trim().StartsWith("Remote branch"))
         {
            context = "remote";
            return;
         } else if (s.Trim().StartsWith("Local branch"))
         {
            context = "local";
            return;
         } else if (s.Trim().StartsWith("Local ref"))
         {
            context = "ref";
            return;
         }

         if (context == "remote")
         {
            var split = s.Trim().Split(' ');
            repo.RemoteBranches.Add(split.First());
         } else if (context == "local")
         {
            var split = s.Trim().Split(' ');
            repo.PullBranches.Add(split.First());
         } else if (context == "ref")
         {
            var split = s.Trim().Split(' ');
            repo.PushBranches.Add(split.First());
         }
      }

      private void QueryGitFileLine(GitRepository repo ,string s)
      {
         if (s.Length < 3)
         {
            return;
         }

         if (this.ReportGit != null)
         {
            this.ReportGit(s);
         }

         char x = s[0];
         char y = s[1];
         string file = s.Substring(3);

         switch (y)
         {
            // branch
            case '#':
               repo.BranchStatus = file;
               break;

            case '?':
               this.AddFileStaus(repo ,GitStatus.Added ,file);
               break;

            case 'M':
               this.AddFileStaus(repo ,GitStatus.Modified ,file);
               break;
         }
      }

      protected void AddFileStaus(GitRepository repo ,GitStatus status ,string file)
      {
         file = file.StartsWith("\"") ? file.Substring(1 ,file.Length - 2) : file;
         var fullFileName = Path.Combine(repo.RootFolder ,file);
         fullFileName = fullFileName.Replace('\\' ,Path.DirectorySeparatorChar);
         fullFileName = fullFileName.Replace('/' ,Path.DirectorySeparatorChar);

         // must be part of one directory
         if (repo.FileStatus.ContainsKey(fullFileName))
         {
            repo.FileStatus[fullFileName] = status;
         } else
         {
            repo.FileStatus.Add(fullFileName ,status);
         }

      }

   }
}

