import { NextFunction, Request, Response } from "express"
import { getRepository, getManager } from "typeorm"
import { Group } from "../entity/group.entity"
import { CreateGroupInput, UpdateGroupInput } from "../interface/group.interface"

export class GroupController {
  private groupRepository = getRepository(Group)

  async allGroups(request: Request, response: Response, next: NextFunction) {
    return this.groupRepository.find()
  }

  async getGroup(request: Request, response: Response, next: NextFunction) {
    return this.groupRepository.find(request.body.id)
  }

  async createGroup(request: Request, response: Response, next: NextFunction) {
    const { body: params } = request
    console.log(params)
    const createGroupInput: CreateGroupInput = {
      name: params.name,
      number_of_weeks: params.number_of_weeks,
      roll_states: params.roll_states,
      incidents: params.incidents,
      ltmt: params.ltmt,
    }
    const group = new Group()
    group.prepareToCreate(createGroupInput)

    return this.groupRepository.save(group)
  }

  async updateGroup(request: Request, response: Response, next: NextFunction) {
    const { body: params } = request

    // add logic to handle update request for undefined id or deleted id data
    return this.groupRepository.findOne(params.id).then((group) => {
      const updateGroupInput: UpdateGroupInput = {
        id: params.id,
        name: params.name,
        number_of_weeks: params.number_of_weeks,
        roll_states: params.roll_states,
        incidents: params.incidents,
        ltmt: params.ltmt,
      }
      group.prepareToUpdate(updateGroupInput)

      return this.groupRepository.save(group)
    })
  }

  async removeGroup(request: Request, response: Response, next: NextFunction) {
    let groupToRemove = await this.groupRepository.findOne(request.body.id)
    return await this.groupRepository.remove(groupToRemove)
  }

  async getGroupStudents(request: Request, response: Response, next: NextFunction) {
    let { number_of_weeks, ltmt, incidents, roll_states } = await this.groupRepository.findOne(request.body.id)

    const entityManager = getManager()

    const groupStudents = await entityManager.query(
      `SELECT student_id, first_name, last_name, (first_name || '  ' ||last_name) as full_name from (
        SELECT  srs.roll_id, r.name,srs.student_id,s.first_name,s.last_name,srs.state, count(*) as incident FROM student_roll_state srs
        INNER JOIN student as s on s.id = srs.student_id
        INNER JOIN roll as r on r.id = srs.roll_id
        WHERE srs.created_at > date('now', '` +
        -7 * number_of_weeks +
        ` days')
        group by srs.state
      ) as incident_data
      WHERE incident ` +
        ltmt +
        ` ` +
        incidents +
        ` and state = '` +
        roll_states +
        `'`
    )

    return groupStudents
  }

  async runGroupFilters(request: Request, response: Response, next: NextFunction) {
    // Task 2:
    // 1. Clear out the groups (delete all the students from the groups)
    // 2. For each group, query the student rolls to see which students match the filter for the group
    // 3. Add the list of students that match the filter to the group
  }
}
