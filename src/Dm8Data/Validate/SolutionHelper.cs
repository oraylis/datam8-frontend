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
using Dm8Data.AttributeTypes;
using Dm8Data.Core;
using Dm8Data.DataProducts;
using Dm8Data.DataSources;
using Dm8Data.DataTypes;
using Dm8Data.Generic;
using Dm8Data.Helper;
using Dm8Data.Index;
using Dm8Data.MessageOutput;
using Dm8Data.Properties;
using Dm8Data.Validate.Exceptions;
using Dm8Locator;
using Dm8Locator.Dm8l;
using Newtonsoft.Json;

namespace Dm8Data.Validate
{
   public class SolutionHelper
   {
      public static string Dm8l2FileName = "index.json";

      // Connection to UI
      private readonly ISendOutputEvents sendOutputEvents;

      // Solution settings
      private readonly string baseDirectory;
      private readonly Solution solution;

      // Index content
      private Index.Index index;
      private Dictionary<Dm8lEntity ,string> dm8l2File;
      private Dictionary<Dm8lEntity ,List<Dm8lEntity>> dm8lReferenced;

      // object cache
      private Dictionary<string ,object> cache;

      // core entity cache
      private Dictionary<string ,CoreEntity> coreCache;

      // curated function cache
      private Dictionary<Dm8lEntity ,List<Curated.CuratedFunction>> functionCache;

      // only refresh index once
      private bool isLoading;

      private string IndexFileName
      {
         get => Path.Combine(this.baseDirectory ,Dm8l2FileName);
      }

      public Solution Solution
      {
         get => this.solution;
      }

      public SolutionHelper(Solution solution ,ISendOutputEvents sendOutputEvents)
      {
         this.sendOutputEvents = sendOutputEvents;
         this.solution = solution;
         this.baseDirectory = this.solution.CurrentRootFolder;
         this.InitCacheObjects();
         this.isLoading = false;
      }

      private void InitCacheObjects()
      {
         lock (this)
         {
            this.index = new Index.Index();
            this.dm8l2File = new Dictionary<Dm8lEntity ,string>(Dm8LocatorComparer.IgnoreCase);
            this.dm8lReferenced = new Dictionary<Dm8lEntity ,List<Dm8lEntity>>(Dm8LocatorComparer.IgnoreCase);
            this.cache = new Dictionary<string ,object>();
            this.coreCache = new Dictionary<string ,CoreEntity>();
            this.functionCache = new Dictionary<Dm8lEntity ,List<Curated.CuratedFunction>>();
         }
      }

      public static void DeleteIndexFile(string path)
      {
         string file = Path.Combine(path ,SolutionHelper.Dm8l2FileName);
         try
         {
            File.Delete(file);
         } catch
         {

         }
      }

      public async Task LoadAsync()
      {
         DateTime dateTimeIdx = DateTime.MinValue;
         DateTime dateTimeFile = DateTime.MinValue;
         // get Raw source files and maximal change date
         var layerList = new Dictionary<string ,List<string>>();


         if (this.isLoading)
            return;

         try
         {
            this.isLoading = true;

            if (File.Exists(this.IndexFileName))
            {
               if (await this.ReadIndexAsync())
               {
                  dateTimeIdx = File.GetLastWriteTimeUtc(this.IndexFileName);
               }
            }


            // raw - layer list
            var rawFileList = new List<string>();
            if (!Directory.Exists(this.solution.RawFolderPath))
               Directory.CreateDirectory(this.solution.RawFolderPath);
            foreach (var f in Directory.EnumerateFiles(this.solution.RawFolderPath ,"*.json" ,
                         SearchOption.AllDirectories))
            {
               rawFileList.Add(f);
               var fileDate = File.GetLastWriteTimeUtc(f);
               if (fileDate > dateTimeFile)
                  dateTimeFile = fileDate;
            }

            layerList.Add(Properties.Resources.Folder_Raw ,rawFileList);

            // stage - layer list
            var stageFileList = new List<string>();
            if (!Directory.Exists(this.solution.StagingFolderPath))
               Directory.CreateDirectory(this.solution.StagingFolderPath);
            foreach (var f in Directory.EnumerateFiles(this.solution.StagingFolderPath ,"*.json" ,
                         SearchOption.AllDirectories))
            {
               stageFileList.Add(f);
               var fileDate = File.GetLastWriteTimeUtc(f);
               if (fileDate > dateTimeFile)
                  dateTimeFile = fileDate;
            }

            layerList.Add(Properties.Resources.Folder_Staging ,stageFileList);

            // core - layer list
            var coreFileList = new List<string>();
            if (!Directory.Exists(this.solution.CoreFolderPath))
               Directory.CreateDirectory(this.solution.CoreFolderPath);
            foreach (var f in Directory.EnumerateFiles(this.solution.CoreFolderPath ,"*.json" ,
                         SearchOption.AllDirectories))
            {
               coreFileList.Add(f);
               var fileDate = File.GetLastWriteTimeUtc(f);
               if (fileDate > dateTimeFile)
                  dateTimeFile = fileDate;
            }

            layerList.Add(Properties.Resources.Folder_Core ,coreFileList);

            // curated - layer list
            var curatedFileList = new List<string>();
            if (!Directory.Exists(this.solution.CuratedFolderPath))
               Directory.CreateDirectory(this.solution.CuratedFolderPath);
            foreach (var f in Directory.EnumerateFiles(this.solution.CuratedFolderPath ,"*.json" ,
                         SearchOption.AllDirectories))
            {
               curatedFileList.Add(f);
               var fileDate = File.GetLastWriteTimeUtc(f);
               if (fileDate > dateTimeFile)
                  dateTimeFile = fileDate;
            }

            layerList.Add(Properties.Resources.Folder_Curated ,curatedFileList);

            // diagram - layer list
            var diagramFileList = new List<string>();
            if (!Directory.Exists(this.solution.DiagramFolderPath))
               Directory.CreateDirectory(this.solution.DiagramFolderPath);
            foreach (var f in Directory.EnumerateFiles(this.solution.DiagramFolderPath ,"*.json" ,
                         SearchOption.AllDirectories))
            {
               diagramFileList.Add(f);
               var fileDate = File.GetLastWriteTimeUtc(f);
               if (fileDate > dateTimeFile)
                  dateTimeFile = fileDate;
            }

            layerList.Add(Properties.Resources.Folder_Diagram ,diagramFileList);

         }
         finally
         {
            this.isLoading = false;
         }
         // validate
         if (dateTimeFile > dateTimeIdx)
         {
            await this.CreateAndValidateAsync(layerList);
         }
      }


      private async Task<bool> ReadIndexAsync()
      {
         try
         {
            await Task.Run(() =>
            {
               lock (this)
               {
                  this.InitCacheObjects();

                  using (StreamReader file = File.OpenText(this.IndexFileName))
                  {
                     JsonSerializer serializer = new JsonSerializer();
                     this.index = (Index.Index)serializer.Deserialize(file ,typeof(Index.Index)) ??
                                      throw new InvalidOperationException();
                  }

                  foreach (var rawEntry in this.index.RawIndex.Entry)
                  {
                     this.dm8l2File.Add(new Dm8lEntity(rawEntry.Locator) ,rawEntry.AbsPath);
                  }

                  foreach (var stageEntry in this.index.StageIndex.Entry)
                  {
                     this.dm8l2File.Add(new Dm8lEntity(stageEntry.Locator) ,stageEntry.AbsPath);
                  }

                  foreach (var coreEntry in this.index.CoreIndex.Entry)
                  {
                     this.dm8l2File.Add(new Dm8lEntity(coreEntry.Locator) ,coreEntry.AbsPath);
                     foreach (var refDm8l in coreEntry.References)
                     {
                        if (this.dm8lReferenced.TryGetValue(new Dm8lEntity(refDm8l) ,out var refList))
                        {
                           refList.Add(new Dm8lEntity(coreEntry.Locator));
                        } else
                        {
                           var newRefList = new List<Dm8lEntity>();
                           newRefList.Add(new Dm8lEntity(coreEntry.Locator));
                           this.dm8lReferenced.Add(new Dm8lEntity(refDm8l) ,newRefList);
                        }

                     }
                  }
               }
            });
            return true;
         } catch
         {
            // recreate index
            this.InitCacheObjects();

            return false;
         }
      }

      public async Task RenameEntityAsync(string filePath ,string oldEntityName ,string newEntityName)
      {
         bool referencedObjectFound = false;

         // update internal index
         Dm8lEntity oldEntity = null;
         Dm8lEntity newEntity = null;
         lock (this)
         {
            // new file path
            var newFilePath = Path.Combine(Path.GetDirectoryName(filePath) ,
                newEntityName + Path.GetExtension(filePath));

            // rename file
            File.Move(filePath ,newFilePath);

            foreach (var v in this.dm8l2File)
            {
               if (v.Value == filePath)
               {
                  oldEntity = new Dm8lEntity(v.Key);
                  newEntity = new Dm8lEntity(oldEntity.Parent as Dm8lModule ,newEntityName);
                  if (this.dm8l2File.ContainsKey(newEntity))
                     this.dm8l2File[newEntity] = newFilePath;
                  else
                     this.dm8l2File.Add(newEntity ,newFilePath);
                  this.dm8l2File.Remove(v.Key);
                  break;
               }
            }

            // update storage index
            foreach (var rawEntry in this.index.RawIndex.Entry)
            {
               if (rawEntry.AbsPath == filePath)
               {
                  rawEntry.AbsPath = newFilePath;
                  rawEntry.Name = newEntityName;
                  rawEntry.Locator = new Dm8lEntity(new Dm8lEntity(rawEntry.Locator).Parent as Dm8lModule ,
                      newEntityName).Value;
               }
            }

            foreach (var stageEntry in this.index.StageIndex.Entry)
            {
               if (stageEntry.AbsPath == filePath)
               {
                  stageEntry.AbsPath = newFilePath;
                  stageEntry.Name = newEntityName;
                  stageEntry.Locator = new Dm8lEntity(new Dm8lEntity(stageEntry.Locator).Parent as Dm8lModule ,
                      newEntityName).Value;
               }
            }

            foreach (var coreEntry in this.index.CoreIndex.Entry)
            {
               if (coreEntry.AbsPath == filePath)
               {
                  coreEntry.AbsPath = newFilePath;
                  coreEntry.Name = newEntityName;
                  coreEntry.Locator = new Dm8lEntity(new Dm8lEntity(coreEntry.Locator).Parent as Dm8lModule ,
                      newEntityName).Value;

                  if (oldEntity != null && newEntity != null)
                  {
                     foreach (var dm8lRef in this.dm8lReferenced)
                     {
                        // check referenced entities -> update index
                        for (int i = 0; i < dm8lRef.Value.Count; i++)
                        {
                           if (dm8lRef.Value[i].Value == oldEntity.Value)
                           {
                              dm8lRef.Value[i] = newEntity;
                           }
                        }
                     }

                     foreach (var dm8lRef in this.dm8lReferenced)
                     {
                        // main object found - rename
                        if (dm8lRef.Key.Value == oldEntity.Value)
                        {
                           this.dm8lReferenced[newEntity] = dm8lRef.Value;
                           this.dm8lReferenced.Remove(dm8lRef.Key);
                           referencedObjectFound = true;
                           break;
                        }
                     }
                  }
               }
            }

         }

         if (referencedObjectFound)
         {
            await this.RenameAttributesAsync(oldEntity ,newEntity);
         }

         // update project index
         await this.SaveAsync();
      }

      public async Task<bool> RenameAttributesAsync(Dm8lEntity oldEntity ,Dm8lEntity newEntity)
      {
         // get list of references entities (already renamed)
         var refList = this.GetReferenced(newEntity.Value).ToList();

         // loop over all referenced objects and check if column must be renamed
         bool oneObjectChanged = false;
         foreach (var refDm8lEntity in refList)
         {
            // check if object is changed
            bool objectChanged = false;

            // load object referencing my entity
            var refCoreEntry =
                await this.LoadOrGetModelEntryAsync<Dm8Data.Core.ModelEntry>(refDm8lEntity);

            // loop over relationships
            foreach (var relationship in refCoreEntry.Entity.Relationship.Where(rel =>
                         new Dm8lEntity(rel.Dm8lKey) == oldEntity))
            {
               relationship.Dm8lKey = newEntity.Value;

               // update relationship
               foreach (var refField in relationship.Fields)
               {
                  var attr = new Dm8lAttribute(refField.Dm8lKeyAttr);
                  refField.Dm8lKeyAttr = new Dm8lAttribute(newEntity ,attr.Name).Value;
                  objectChanged = true;
               }
            }

            // save entry
            if (objectChanged)
            {
               await this.SaveModelEntryAsync(refDm8lEntity ,refCoreEntry);
               oneObjectChanged = true;
            }
         }

         return oneObjectChanged;
      }

      public async Task<bool> RenameAttributeAsync(Dm8lEntity dm8lEntity ,string oldName ,string newName)
      {
         // get list of references entities
         var refList = this.GetReferenced(dm8lEntity).ToList();

         // loop over all referenced objects and check if column must be renamed
         var oldAttr = new Dm8lAttribute(dm8lEntity ,oldName);
         var newAttr = new Dm8lAttribute(dm8lEntity ,newName);
         bool oneObjectChanged = false;
         foreach (var refDm8lEntity in refList)
         {
            // check if object is changed
            bool objectChanged = false;

            // load object referencing my entity
            var refCoreEntry =
                await this.LoadOrGetModelEntryAsync<Dm8Data.Core.ModelEntry>(refDm8lEntity);

            // loop over relationships
            foreach (var relationship in refCoreEntry.Entity.Relationship)
            {
               // update relationship
               foreach (var refField in relationship.Fields.Where(relationshipField =>
                            new Dm8lAttribute(relationshipField.Dm8lKeyAttr).Equals(
                                new Dm8lAttribute(oldAttr.Value))))
               {
                  refField.Dm8lKeyAttr = newAttr.Value;
                  objectChanged = true;
               }
            }

            // save entry
            if (objectChanged)
            {
               await this.SaveModelEntryAsync(refDm8lEntity ,refCoreEntry);
               oneObjectChanged = true;
            }
         }

         return oneObjectChanged;
      }

      private async Task SaveAsync()
      {
         await Task.Run(() =>
         {
            lock (this)
            {
               using var stream = File.Open(this.IndexFileName ,FileMode.Create);
               using var sw = new StreamWriter(stream);
               using var jw = new JsonTextWriter(sw);
               JsonSerializer serializer = new JsonSerializer() { Formatting = Newtonsoft.Json.Formatting.Indented };
               serializer.Serialize(jw ,this.index ,this.GetType());
            }
         });
      }


      #region Cache

      public void ResetObjectCache()
      {
         lock (this.cache)
         {
            this.cache = new Dictionary<string ,object>();
         }
      }

      public string GetFileName(string dm8l)
      {
         return this.GetFileName(new Dm8lEntity(dm8l));
      }

      public Dm8lEntity GetDm8lFromFileName(string fileName)
      {
         lock (this)
         {
            foreach (var cacheEntry in this.dm8l2File)
            {
               if (cacheEntry.Value == fileName)
               {
                  return cacheEntry.Key;
               }
            }
            return null;
         }
      }

      public string GetFileName(Dm8lEntity dm8lEntity)
      {
         lock (this)
         {
            if (this.dm8l2File.TryGetValue(dm8lEntity ,out string fileName))
            {
               return fileName;
            } else
            {
               return null;
            }
         }
      }

      protected void SetFileName(string dm8l ,string path)
      {
         this.SetFileName(new Dm8lEntity(dm8l) ,path);
      }

      protected void SetFileName(Dm8lEntity dm8lEntity ,string path)
      {
         if (this.dm8l2File.ContainsKey(dm8lEntity))
         {
            this.dm8l2File[dm8lEntity] = path;
         } else
         {
            this.dm8l2File.Add(dm8lEntity ,path);
         }
      }

      public IEnumerable<Dm8lEntity> GetReferenced(string dm8l)
      {
         return this.GetReferenced(new Dm8lEntity(dm8l));
      }

      public IEnumerable<Dm8lEntity> GetReferenced(Dm8lEntity dm8lEntity)
      {
         if (this.dm8lReferenced.TryGetValue(dm8lEntity ,out var refList))
         {
            return refList;
         }

         return new List<Dm8lEntity>();
      }

      public async Task<IEnumerable<TObjRef>> LoadOrGetModelList<TObjRef, TObjList>(string path)
          where TObjRef : class, new()
          where TObjList : class, IModelEntryList<TObjRef>, new()
      {
         lock (this.cache)
         {
            if (this.cache.TryGetValue(path ,out object rc))
            {
               return rc as IEnumerable<TObjRef>;
            }
         }

         var reader = new ModelReaderList<TObjRef ,TObjList>();
         var refList = await reader.ReadFromFileAsync(path);
         lock (this.cache)
         {
            // double check if already loaded twice
            if (this.cache.TryGetValue(path ,out var rc))
            {
               return rc as IEnumerable<TObjRef>;
            }

            this.cache.Add(path ,refList);
            return refList;
         }
      }

      public async Task<TObj> LoadOrGetModelEntryAsync<TObj>(Dm8lEntity entity) where TObj : class, new()
      {
         var filePath = this.GetFileName(entity.Value);
         if (filePath == null)
         {
            throw new ArgumentException(string.Format(Resources.SolutionHelper_GetOrCreateEntry_NotFound ,
                entity.Value));
         }

         var obj = await this.LoadOrGetModelEntryAsync<TObj>(filePath);
         return (TObj)obj;
      }

      public async Task<CoreEntity> LoadOrGetCoreEntityAsync(Dm8lEntity entity)
      {
         var filePath = this.GetFileName(entity.Value);
         if (filePath == null)
         {
            throw new ArgumentException(string.Format(Resources.SolutionHelper_GetOrCreateEntry_NotFound ,
                entity.Value));
         }

         if (entity.Value.StartsWith("/Curated"))
         {
            var reader = new CuratedModelReader();
            var obj = await this.LoadOrGetCoreEntityAsync(filePath ,reader);
            return obj;
         } else
         {
            var obj = await this.LoadOrGetCoreEntityAsync(filePath ,new CoreModelReader());
            return obj;
         }
      }

      public async Task<CoreEntity> LoadOrGetCoreEntityAsync(string filePath)
      {

         if (filePath.StartsWith(this.Solution.CuratedFolderPath))
         {
            var obj = await this.LoadOrGetCoreEntityAsync(filePath ,new CuratedModelReader());
            return obj;
         } else
         {
            var obj = await this.LoadOrGetCoreEntityAsync(filePath ,new CoreModelReader());
            return obj;
         }
      }


      public async Task SaveModelEntryAsync<TObj>(Dm8lEntity dm8lEntity ,TObj modelEntry ,string path = null)
          where TObj : class, new()
      {
         await this.SaveModelEntryAsync(dm8lEntity.Value ,modelEntry ,path);
      }

      public async Task SaveModelEntryAsync<TObj>(string dm8l ,TObj modelEntry ,string path = null)
          where TObj : class, new()
      {
         var filePath = path ?? this.GetFileName(dm8l);
         if (filePath == null)
         {
            throw new ArgumentException(string.Format(Resources.SolutionHelper_GetOrCreateEntry_NotFound ,dm8l));
         }

         if (path != null)
         {
            this.SetFileName(dm8l ,path);
         }

         var modelEntityJson = FileHelper.MakeJson(modelEntry);
         await FileHelper.WriteFileAsync(filePath ,modelEntityJson);
      }

      public async Task<TObj> LoadOrGetModelEntryAsync<TObj>(string path)
          where TObj : class, new()
      {
         lock (this.cache)
         {
            if (this.cache.TryGetValue(path ,out var rc))
            {
               return rc as TObj;
            }
         }

         var reader = ModelReaderFactory.Create(typeof(TObj)) as ModelReader<TObj>;
         var refList = await reader.ReadFromFileAsync(path);
         lock (this.cache)
         {
            // double check if already loaded twice
            if (this.cache.TryGetValue(path ,out var rc))
            {
               return rc as TObj;
            }

            this.cache.Add(path ,refList);
            return refList;
         }
      }

      public async Task<CoreEntity> LoadOrGetCoreEntityAsync<TObj>(string path ,ModelReader<TObj> reader)
          where TObj : class, ICoreModel, new()
      {
         lock (this.coreCache)
         {
            if (this.coreCache.TryGetValue(path ,out var rc))
            {
               return rc;
            }
         }

         var modelObj = await reader.ReadFromFileAsync(path);
         lock (this.coreCache)
         {
            // double check if already loaded twice
            if (this.coreCache.TryGetValue(path ,out var rc))
            {
               return rc;
            }

            this.coreCache.Add(path ,modelObj.Entity);

            // also cache function in case of cureated model
            if (modelObj is Curated.ModelEntry curatedModel)
            {
               this.functionCache.Add(new Dm8lEntity(curatedModel.Entity.Dm8l) ,new List<Curated.CuratedFunction>(curatedModel.Function));
            }
            return modelObj.Entity;
         }
      }

      public List<Curated.CuratedFunction> GetFunctions(Dm8lEntity dm8lEntity)
      {
         if (this.functionCache.TryGetValue(dm8lEntity ,out var curatedFunctions))
         {
            return curatedFunctions;
         }
         return new List<Curated.CuratedFunction>();
      }
      #endregion


      #region Create Index

      public async Task CreateAndValidateAsync(Dictionary<string ,List<string>> layerList = null)
      {
         // recreate index
         if (this.isLoading)
            return;

         lock (this)
         {
            this.InitCacheObjects();
            this.isLoading = true;
         }

         try
         {

            // Clear output
            this.sendOutputEvents.ClearEvents();

            // validate base files
            await this.ValidateBaseModelObject(typeof(AttributeType) ,this.solution.AttributeTypesFilePath);
            await this.ValidateBaseModelObject(typeof(DataType) ,this.solution.DataTypesFilePath);
            await this.ValidateBaseModelObject(typeof(DataSource) ,this.solution.DataSourcesFilePath);
            await this.ValidateBaseModelObject(typeof(DataProduct) ,this.solution.DataProductsFilePath);

            var rawFileList = layerList?.GetValueOrDefault(Properties.Resources.Folder_Raw);
            if (rawFileList == null)
            {
               rawFileList = Directory
                   .EnumerateFiles(this.solution.RawFolderPath ,"*.json" ,SearchOption.AllDirectories).ToList();
            }

            await this.CreateRawIndex(rawFileList);

            var stagingFileList = layerList?.GetValueOrDefault(Properties.Resources.Folder_Staging);
            if (stagingFileList == null)
            {
               stagingFileList = Directory
                   .EnumerateFiles(this.solution.StagingFolderPath ,"*.json" ,SearchOption.AllDirectories)
                   .ToList();
            }

            await this.CreateStageIndex(stagingFileList);


            var coreFileList = layerList?.GetValueOrDefault(Properties.Resources.Folder_Core);
            if (coreFileList == null)
            {
               coreFileList = Directory
                   .EnumerateFiles(this.solution.CoreFolderPath ,"*.json" ,SearchOption.AllDirectories).ToList();
            }

            await this.CreateCoreIndex(coreFileList);

            var curatedFileList = layerList?.GetValueOrDefault(Properties.Resources.Folder_Curated);
            if (curatedFileList == null)
            {
               curatedFileList = Directory
                   .EnumerateFiles(this.solution.CuratedFolderPath ,"*.json" ,SearchOption.AllDirectories)
                   .ToList();
            }

            await this.CreateCuratedIndex(curatedFileList);

            var diagramFileList = layerList?.GetValueOrDefault(Properties.Resources.Folder_Diagram);
            if (diagramFileList == null)
            {
               diagramFileList = Directory
                   .EnumerateFiles(this.solution.DiagramFolderPath ,"*.json" ,SearchOption.AllDirectories)
                   .ToList();
            }


            // add no error result - filtered out in case error is added
            this.sendOutputEvents.SendOutputEvent(new OutputItem { Code = "" ,Description = Resources.Validate_NoError });

            // save index files
            await this.SaveAsync();
         }
         finally
         {
            this.isLoading = false;
         }
      }



      private async Task ValidateBaseModelObject(Type type ,string filePath)
      {
         try
         {
            var modelObjectReader = ModelReaderFactory.Create(type);
            var modelObjectList = await modelObjectReader.ReadFromFileAsync(filePath);
            var newErrorList = await modelObjectReader.ValidateObjectAsync(this ,modelObjectList);
            foreach (var validateException in newErrorList)
            {
               validateException.FilePath = filePath;
               this.sendOutputEvents.SendOutputEvent(new OutputItem(validateException ,this.solution));
            }
         } catch (Exception ex)
         {
            this.sendOutputEvents.SendOutputEvent(new OutputItem(new UnknownValidateException(ex ,filePath) ,
                this.Solution));
         }
      }

      private async Task CreateRawIndex(List<string> rawFileList)
      {
         // load source entities
         this.index.RawIndex = new RawIndex();
         this.index.RawIndex.Entry = new List<IndexEntry>();

         foreach (var rawEntityFileName in rawFileList)
         {
            try
            {
               RawModelReader sourceEntityValidator = new RawModelReader();
               var rawEntity = await sourceEntityValidator.ReadFromFileAsync(rawEntityFileName);
               if (rawEntity != null)
               {
                  lock (this)
                  {
                     this.dm8l2File.Add(new Dm8lEntity(rawEntity.Entity.Dm8l) ,rawEntityFileName);
                     this.index.RawIndex.Entry.Add(new IndexEntry
                     {
                        Locator = rawEntity.Entity.Dm8l ,
                        Name = rawEntity.Entity.Name ,
                        AbsPath = rawEntityFileName
                     });
                  }
               }

               var validationExceptions = await sourceEntityValidator.ValidateObjectAsync(this ,rawEntity);
               foreach (var validateException in validationExceptions)
               {
                  validateException.FilePath = rawEntityFileName;
                  this.sendOutputEvents.SendOutputEvent(new OutputItem(validateException ,this.solution));
               }
            } catch (Exception ex)
            {
               this.sendOutputEvents.SendOutputEvent(
                   new OutputItem(new UnknownValidateException(ex ,rawEntityFileName) ,this.solution));
            }
         }
      }

      private async Task CreateStageIndex(List<string> stageFileList)
      {
         // load source entities
         this.index.StageIndex = new StageIndex();
         this.index.StageIndex.Entry = new List<IndexEntry>();

         foreach (var stageEntityFileName in stageFileList)
         {
            try
            {
               StageModelReader sourceEntityValidator = new StageModelReader();
               var stageEntity = await sourceEntityValidator.ReadFromFileAsync(stageEntityFileName);
               if (stageEntity != null)
               {
                  lock (this)
                  {
                     this.dm8l2File.Add(new Dm8lEntity(stageEntity.Entity.Dm8l) ,stageEntityFileName);
                     this.index.StageIndex.Entry.Add(new IndexEntry
                     {
                        Locator = stageEntity.Entity.Dm8l ,
                        Name = stageEntity.Entity.Name ,
                        AbsPath = stageEntityFileName
                     });
                  }
               }

               var validationExceptions = await sourceEntityValidator.ValidateObjectAsync(this ,stageEntity);
               foreach (var validateException in validationExceptions)
               {
                  validateException.FilePath = stageEntityFileName;
                  this.sendOutputEvents.SendOutputEvent(new OutputItem(validateException ,this.solution));
               }
            } catch (Exception ex)
            {
               this.sendOutputEvents.SendOutputEvent(
                   new OutputItem(new UnknownValidateException(ex ,stageEntityFileName) ,this.solution));
            }
         }
      }

      private async Task CreateCoreIndex(List<string> coreFileList)
      {
         // load source entities
         this.index.CoreIndex = new CoreIndex();
         this.index.CoreIndex.Entry = new List<IndexEntry>();

         foreach (var coreEntityFileName in coreFileList)
         {
            try
            {
               CoreModelReader coreEntityReader = new CoreModelReader();
               var coreEntity = await coreEntityReader.ReadFromFileAsync(coreEntityFileName);
               if (coreEntity != null)
               {
                  lock (this)
                  {
                     var references = coreEntity.Entity.Relationship.Select(r => r.Dm8lKey).ToList();
                     this.index.CoreIndex.Entry.Add(new IndexEntry
                     {
                        Locator = coreEntity.Entity.Dm8l ,
                        Name = coreEntity.Entity.Name ,
                        AbsPath = coreEntityFileName ,
                        References = references
                     });

                     // create reverse index -> add this object to "his" references
                     this.dm8l2File.Add(new Dm8lEntity(coreEntity.Entity.Dm8l) ,coreEntityFileName);
                     foreach (var reference in references)
                     {
                        if (this.dm8lReferenced.TryGetValue(new Dm8lEntity(reference) ,out var refList))
                        {
                           refList.Add(new Dm8lEntity(coreEntity.Entity.Dm8l));
                        } else
                        {
                           var newRefList = new List<Dm8lEntity>();
                           newRefList.Add(new Dm8lEntity(coreEntity.Entity.Dm8l));
                           this.dm8lReferenced.Add(new Dm8lEntity(reference) ,newRefList);
                        }
                     }
                  }
               }

               var validationExceptions = await coreEntityReader.ValidateObjectAsync(this ,coreEntity);
               foreach (var validateException in validationExceptions)
               {
                  validateException.FilePath = coreEntityFileName;
                  this.sendOutputEvents.SendOutputEvent(new OutputItem(validateException ,this.solution));
               }
            } catch (Exception ex)
            {
               this.sendOutputEvents.SendOutputEvent(
                   new OutputItem(new UnknownValidateException(ex ,coreEntityFileName) ,this.solution));
            }
         }
      }

      private async Task CreateCuratedIndex(List<string> curatedFileList)
      {
         // load source entities
         this.index.CuratedIndex = new CuratedIndex();
         this.index.CuratedIndex.Entry = new List<IndexEntry>();

         // Reader and list of new object
         CuratedModelReader curatedModelReader = new CuratedModelReader();
         var newCuratedObjects = new Dictionary<string ,Curated.ModelEntry>();

         // first create object
         foreach (var curatedEntityFileName in curatedFileList)
         {
            try
            {
               var curatedObject = await curatedModelReader.ReadFromFileAsync(curatedEntityFileName);
               if (curatedObject != null)
               {
                  newCuratedObjects.Add(curatedEntityFileName ,curatedObject);
                  lock (this)
                  {
                     var references = curatedObject.Entity.Relationship.Select(r => r.Dm8lKey).ToList();
                     this.index.CuratedIndex.Entry.Add(new IndexEntry
                     {
                        Locator = curatedObject.Entity.Dm8l ,
                        Name = curatedObject.Entity.Name ,
                        AbsPath = curatedEntityFileName ,
                        References = references
                     });

                     // create reverse index -> add this object to "his" references
                     this.dm8l2File.Add(new Dm8lEntity(curatedObject.Entity.Dm8l) ,curatedEntityFileName);
                     foreach (var reference in references)
                     {
                        if (this.dm8lReferenced.TryGetValue(new Dm8lEntity(reference) ,out var refList))
                        {
                           refList.Add(new Dm8lEntity(curatedObject.Entity.Dm8l));
                        } else
                        {
                           var newRefList = new List<Dm8lEntity>();
                           newRefList.Add(new Dm8lEntity(curatedObject.Entity.Dm8l));
                           this.dm8lReferenced.Add(new Dm8lEntity(reference) ,newRefList);
                        }
                     }
                  }
               }
            } catch (Exception ex)
            {
               this.sendOutputEvents.SendOutputEvent(
                   new OutputItem(new UnknownValidateException(ex ,curatedEntityFileName) ,this.solution));
            }
         }

         foreach (var curatedObject in newCuratedObjects)
         {
            try
            {
               var validationExceptions = await curatedModelReader.ValidateObjectAsync(this ,curatedObject.Value);
               foreach (var validateException in validationExceptions)
               {
                  validateException.FilePath = curatedObject.Key;
                  this.sendOutputEvents.SendOutputEvent(new OutputItem(validateException ,this.solution));
               }
            } catch (Exception ex)
            {
               this.sendOutputEvents.SendOutputEvent(
                   new OutputItem(new UnknownValidateException(ex ,curatedObject.Key) ,this.solution));
            }
         }
      }
      #endregion
   }

}
