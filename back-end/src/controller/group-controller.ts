import { NextFunction, Request, Response } from "express"
import { getRepository, getManager } from "typeorm"
import { Group } from "../entity/group.entity"
import { GroupStudent } from "../entity/group-student.entity"
import { CreateGroupInput, UpdateGroupInput } from "../interface/group.interface"
import { CreateGroupStudentInput } from "../interface/group-student.interface"
import { map } from "lodash"

export class GroupController {
  private groupRepository = getRepository(Group)
  private groupStudentRepository = getRepository(GroupStudent)

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
    let allGroupStudent = await this.groupStudentList(number_of_weeks, ltmt, incidents, roll_states)
    allGroupStudent = allGroupStudent.map((groupStudent) => {
      const { student_id, first_name, last_name, full_name } = groupStudent
      return { student_id, first_name, last_name, full_name }
    })
    return allGroupStudent
  }

  private async groupStudentList(number_of_weeks: number, ltmt: string, incidents: number, roll_states: string) {
    const entityManager = getManager()

    return await entityManager.query(
      `SELECT roll_id,name as roll_name,student_id, first_name, last_name,
        (first_name || '  ' ||last_name) as full_name,state,incident_count
      from (
        SELECT  srs.roll_id, r.name,srs.student_id,s.first_name,s.last_name,srs.state, count(*) as incident_count FROM student_roll_state srs
        INNER JOIN student as s on s.id = srs.student_id
        INNER JOIN roll as r on r.id = srs.roll_id
        WHERE srs.created_at > date('now', '` +
        -7 * number_of_weeks +
        ` days')
        group by srs.state
      ) as incident_data
      WHERE incident_count ` +
        ltmt +
        ` ` +
        incidents +
        ` and state = '` +
        roll_states +
        `'`
    )
  }

  private async removeAllGroupStudent() {
    let groupStudentToRemove = await this.groupStudentRepository.find()
    return await this.groupStudentRepository.remove(groupStudentToRemove)
  }

  private async addGroupStudent(groupStudentInput: CreateGroupStudentInput[], groupId: number) {
    const groupStudent: GroupStudent[] = map(groupStudentInput, (param) => {
      const createStudentRollStateInput: CreateGroupStudentInput = {
        group_id: groupId,
        student_id: param.student_id,
        incident_count: param.incident_count,
      }

      const groupStudent = new GroupStudent()
      groupStudent.prepareToCreate(createStudentRollStateInput)
      return groupStudent
    })
    return this.groupStudentRepository.save(groupStudent)
  }

  async runGroupFilters(request: Request, response: Response, next: NextFunction) {
    const removeData = await this.removeAllGroupStudent()
    let allGroup = await this.groupRepository.find()
    const groupStudent = map(allGroup, async (group) => {
      const groupStudents = await this.groupStudentList(group.number_of_weeks, group.ltmt, group.incidents, group.roll_states)
      if (groupStudents.length > 0) {
        this.addGroupStudent(groupStudents, group.id)
      }
      const run_at = new Date()
      this.groupRepository.findOne(group.id).then((group) => {
        const updateGroupInput: UpdateGroupInput = {
          id: group.id,
          name: group.name,
          number_of_weeks: group.number_of_weeks,
          roll_states: group.roll_states,
          incidents: group.incidents,
          ltmt: group.ltmt,
          run_at: run_at,
          student_count: groupStudents.length,
        }
        group.prepareToUpdate(updateGroupInput)

        return this.groupRepository.save(group)
      })
    })
    if (groupStudent.length > 0) {
      return true
    } else {
      return false
    }
  }
}
